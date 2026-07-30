import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { unlink, readFile } from 'node:fs/promises';
import { generationConfig } from '../config/generationConfig.js';
import { AppError } from '../utils/errors.js';
import { validateImageBuffer } from '../utils/fileValidation.js';
import { normalizeAdditionalInstruction } from '../utils/additionalInstruction.js';
import { summarize } from '../repositories/localBatchRepository.js';

function assertTemplateGenerationReady(publicTemplate) {
  if (!publicTemplate.prompt?.trim()) {
    throw new AppError('BATCH_TEMPLATE_PROFILE_INCOMPLETE', 'Este Template ainda não tem um perfil de geração configurado. Configure o prompt antes de criar um lote.', { status: 422 });
  }
}

const ITEM_FINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
export function createBatchService({ repository, templateService, config = generationConfig, uuid = randomUUID, now = () => new Date(), estimatePerItemUsd = 0.034 } = {}) {
  if (!repository || !templateService) throw new TypeError('BatchService requires repository and templateService.');
  let queue;
  const iso = () => now().toISOString();
  async function create({ name, templateId, files = [], additionalInstruction }) {
    const normalizedName = String(name || '').trim().replace(/\s+/g, ' ');
    if (!normalizedName || normalizedName.length > 100) throw new AppError('INVALID_BATCH_NAME', 'Informe um nome de lote de até 100 caracteres.', { status: 400 });
    if (!files.length) throw new AppError('BATCH_EMPTY', 'Adicione ao menos uma roupa ao lote.', { status: 400 });
    const snapshot = await templateService.getForGeneration(templateId);
    assertTemplateGenerationReady(snapshot.publicTemplate);
    const normalizedInstruction = normalizeAdditionalInstruction(additionalInstruction);
    const hashes = new Set(); const items = [];
    try {
      for (const file of files) {
        const buffer = file.buffer || await readFile(file.path);
        const image = validateImageBuffer(buffer, { expectedMimeType: file.mimetype, maxBytes: config.maxFileSizeBytes, fieldLabel: 'Imagem da roupa', fileName: file.originalname, role: 'garment', policy: config.imagePolicy });
        const digest = createHash('sha256').update(image.buffer).digest('hex'); if (hashes.has(digest)) throw new AppError('DUPLICATE_BATCH_FILE', 'A mesma imagem foi enviada mais de uma vez ao lote.', { status: 400 }); hashes.add(digest);
        items.push({ id: uuid(), originalFileName: basename(file.originalname || 'roupa'), garmentMime: image.mimeType, garmentDimensions: image.dimensions, sizeBytes: image.buffer.length, status: 'queued', resultId: null, costUsd: null, durationMs: null, providerRequestId: null, safeError: null, attempts: 0, createdAt: iso(), updatedAt: iso(), startedAt: null, completedAt: null, buffer: image.buffer });
      }
      const createdAt = iso();
      const batch = {
        id: uuid(), name: normalizedName,
        templateId: snapshot.publicTemplate.id, templateLabel: snapshot.publicTemplate.label,
        templateCategory: snapshot.publicTemplate.category, templateMime: snapshot.image.mimeType, templateDimensions: snapshot.image.dimensions,
        templatePrompt: snapshot.publicTemplate.prompt, templateNegativePrompt: snapshot.publicTemplate.negativePrompt,
        templateProvider: snapshot.publicTemplate.provider, templateModelId: snapshot.publicTemplate.modelId,
        templateGenerationAspectRatio: snapshot.publicTemplate.generationAspectRatio, templateResolution: snapshot.publicTemplate.resolution,
        templatePromptVersion: snapshot.publicTemplate.promptVersion,
        additionalInstruction: normalizedInstruction,
        status: 'ready', totalItems: 0, completedItems: 0, failedItems: 0, cancelledItems: 0, interruptedItems: 0, estimatedCostUsd: Number((items.length * estimatePerItemUsd).toFixed(6)), actualCostUsd: null, createdAt, updatedAt: createdAt, startedAt: null, completedAt: null, pauseRequested: false, cancelRequested: false,
      };
      return publicBatch(await repository.create({ batch, template: { buffer: snapshot.image.buffer, mimeType: snapshot.image.mimeType }, items }));
    } finally { await Promise.all(files.filter((file) => file.path).map((file) => unlink(file.path).catch(() => {}))); }
  }
  async function list() { return (await repository.list()).map(publicBatch); }
  async function get(id) { return publicBatch(await repository.get(id)); }
  async function start(id, { confirmPaid } = {}) {
    if (!confirmPaid) throw new AppError('CREDIT_CONFIRMATION_REQUIRED', 'Confirme o uso de créditos antes de iniciar o lote.', { status: 400 });
    const current = await repository.get(id);
    if (!current.templatePrompt?.trim()) {
      throw new AppError('BATCH_TEMPLATE_PROFILE_INCOMPLETE', 'Este lote foi criado antes dos perfis de geração por Template. Cancele-o e crie um novo lote com um Template configurado.', { status: 422 });
    }
    const batch = await repository.update(id, (next) => { if (!['ready', 'paused', 'interrupted'].includes(next.status) || !next.items.some((i) => i.status === 'queued')) throw new AppError('BATCH_NOT_STARTABLE', 'Este lote não possui itens pendentes para iniciar.', { status: 409 }); next.status = 'running'; next.pauseRequested = false; next.cancelRequested = false; next.startedAt ||= iso(); return next; });
    queue?.enqueue(id);
    return publicBatch(batch);
  }
  async function pause(id) { return publicBatch(await repository.update(id, (next) => { if (next.status !== 'running') throw new AppError('BATCH_NOT_RUNNING', 'O lote não está em execução.', { status: 409 }); next.pauseRequested = true; if (!next.items.some((item) => ['preparing', 'generating'].includes(item.status))) next.status = 'paused'; return next; })); }
  async function resume(id) { return start(id, { confirmPaid: true }); }
  async function cancel(id) { return publicBatch(await repository.update(id, (next) => { if (!['ready', 'running', 'paused', 'interrupted'].includes(next.status)) throw new AppError('BATCH_NOT_CANCELLABLE', 'Este lote não pode mais ser cancelado.', { status: 409 }); next.cancelRequested = true; for (const item of next.items) if (item.status === 'queued') { item.status = 'cancelled'; item.updatedAt = iso(); item.completedAt = iso(); } if (!next.items.some((item) => ['preparing', 'generating'].includes(item.status))) { next.status = 'cancelled'; next.completedAt = iso(); } return next; })); }
  async function prepareNext(id) { return repository.update(id, (next) => { if (next.cancelRequested) { finishCancellation(next, iso); return next; } if (next.pauseRequested) { next.status = 'paused'; return next; } const item = next.items.find((candidate) => candidate.status === 'queued'); if (!item) { finish(next, iso); return next; } item.status = 'preparing'; item.updatedAt = iso(); next.status = 'running'; next._preparedItemId = item.id; return next; }).then((batch) => batch._preparedItemId ? { batch, item: batch.items.find((i) => i.id === batch._preparedItemId) } : null); }
  async function beginPrepared(id, itemId) { return repository.update(id, (next) => { delete next._preparedItemId; const item = next.items.find((candidate) => candidate.id === itemId); if (!item || item.status !== 'preparing' || next.pauseRequested || next.cancelRequested) { if (item?.status === 'preparing') item.status = next.cancelRequested ? 'cancelled' : 'queued'; if (next.cancelRequested) finishCancellation(next, iso); else if (next.pauseRequested) next.status = 'paused'; return next; } item.status = 'generating'; item.attempts = 1; item.startedAt = iso(); item.updatedAt = iso(); return next; }).then((batch) => batch.items.find((item) => item.id === itemId)?.status === 'generating'); }
  async function executionInput(id, itemId) { const batch = await repository.get(id); const item = batch.items.find((candidate) => candidate.id === itemId); if (!item) throw new AppError('BATCH_ITEM_NOT_FOUND', 'O item do lote não foi encontrado.', { status: 404 }); const garment = await repository.readGarment(id, itemId); const templateSnapshot = await repository.readTemplate(id); return { templateSnapshot, additionalInstruction: batch.additionalInstruction ?? null, garmentFile: { buffer: garment.buffer, mimetype: garment.mimeType, originalname: garment.originalname, size: garment.size } }; }
  async function complete(id, itemId, result) { return repository.update(id, (next) => { const item = requireItem(next, itemId); item.status = 'completed'; item.resultId = result.generationId; item.costUsd = result.metrics.costUsd; item.durationMs = result.metrics.durationMs; item.providerRequestId = result.requestId || null; item.completedAt = iso(); item.updatedAt = iso(); finish(next, iso); return next; }); }
  async function fail(id, itemId, error) { return repository.update(id, (next) => { const item = requireItem(next, itemId); item.status = 'failed'; item.safeError = { code: error?.code || 'GENERATION_FAILED', message: error?.message || 'A geração deste item falhou.' }; item.completedAt = iso(); item.updatedAt = iso(); finish(next, iso); return next; }); }
  async function recoverInterruptedItems({ resultStorage } = {}) {
    if (!resultStorage?.listEntries || !resultStorage?.readAsset) return { recovered: 0 };

    const candidatesByItem = new Map();
    for (const entry of await resultStorage.listEntries()) {
      const metadata = entry?.metadata;
      if (!isRecoveryCandidate(metadata)) continue;
      const key = recoveryKey(metadata.batchId, metadata.batchItemId);
      const candidates = candidatesByItem.get(key) || [];
      candidates.push(metadata);
      candidatesByItem.set(key, candidates);
    }

    let recovered = 0;
    for (const batch of await repository.list()) {
      const matches = [];
      for (const item of batch.items || []) {
        if (item.status !== 'interrupted') continue;
        const candidates = candidatesByItem.get(recoveryKey(batch.id, item.id));
        if (!candidates || candidates.length !== 1) continue;
        const [metadata] = candidates;
        try {
          const asset = await resultStorage.readAsset(metadata.id, 'result');
          if (!isValidRecoveryAsset(asset)) continue;
          matches.push({ itemId: item.id, metadata });
        } catch {
          // Sem asset local válido, o item permanece interrupted e nunca é reenfileirado automaticamente.
        }
      }
      if (!matches.length) continue;
      await repository.update(batch.id, (next) => {
        for (const { itemId, metadata } of matches) {
          const item = next.items.find((candidate) => candidate.id === itemId);
          if (!item || item.status !== 'interrupted') continue;
          item.status = 'completed';
          item.resultId = metadata.id;
          item.costUsd = metadata.costUsd ?? null;
          item.durationMs = metadata.durationMs ?? null;
          item.providerRequestId = typeof metadata.providerRequestId === 'string' ? metadata.providerRequestId : null;
          item.safeError = null;
          item.completedAt = validIso(metadata.createdAt) ? metadata.createdAt : iso();
          item.updatedAt = iso();
          recovered += 1;
        }
        finish(next, iso);
        return next;
      });
    }
    return { recovered };
  }
  return Object.freeze({ create, list, get, start, pause, resume, cancel, prepareNext, beginPrepared, executionInput, complete, fail, recoverInterruptedItems, setQueue: (value) => { queue = value; } });
}
function recoveryKey(batchId, batchItemId) { return `${batchId}\u0000${batchItemId}`; }
function isRecoveryCandidate(metadata) { return Boolean(metadata && metadata.status === 'success' && validIso(metadata.createdAt) && isSafeRecoveryId(metadata.id) && typeof metadata.batchId === 'string' && typeof metadata.batchItemId === 'string' && hasValidRecoveryNumbers(metadata)); }
function isSafeRecoveryId(value) { return /^[a-zA-Z0-9-]+$/.test(value); }
function isValidRecoveryAsset(asset) { return Boolean(asset?.buffer?.length && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)); }
function hasValidRecoveryNumbers(metadata) { return isOptionalNonNegativeFinite(metadata.costUsd) && isOptionalNonNegativeFinite(metadata.durationMs); }
function isOptionalNonNegativeFinite(value) { return value == null || (typeof value === 'number' && Number.isFinite(value) && value >= 0); }
function validIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function requireItem(batch, id) { const item = batch.items.find((candidate) => candidate.id === id); if (!item) throw new AppError('BATCH_ITEM_NOT_FOUND', 'O item do lote não foi encontrado.', { status: 404 }); return item; }
function finishCancellation(batch, iso) { for (const item of batch.items) if (item.status === 'queued' || item.status === 'preparing') { item.status = 'cancelled'; item.completedAt = iso(); } if (!batch.items.some((item) => item.status === 'generating')) { batch.status = 'cancelled'; batch.completedAt = iso(); } summarize(batch); }
function finish(batch, iso) { summarize(batch); if (batch.cancelRequested) return finishCancellation(batch, iso); if (batch.pauseRequested) { batch.status = 'paused'; return; } if (batch.items.some((item) => ['queued', 'preparing', 'generating'].includes(item.status))) return; batch.status = batch.failedItems || batch.cancelledItems || batch.interruptedItems ? 'completed_with_errors' : 'completed'; batch.completedAt = iso(); }
function publicBatch(batch) { const clean = JSON.parse(JSON.stringify(batch)); delete clean.templateStorageKey; delete clean._preparedItemId; for (const item of clean.items || []) delete item.garmentStorageKey; return clean; }
