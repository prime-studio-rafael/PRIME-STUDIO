import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { unlink, readFile } from 'node:fs/promises';
import { generationConfig } from '../config/generationConfig.js';
import { AppError } from '../utils/errors.js';
import { validateImageBuffer } from '../utils/fileValidation.js';
import { normalizeAdditionalInstruction } from '../utils/additionalInstruction.js';
import { appendBatchEvent } from '../utils/batchEvents.js';
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
  const record = (batch, type, input = {}) => appendBatchEvent(batch, { type, at: iso(), ...input }, { createId: uuid });
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
      record(batch, 'batch_created', { data: { count: items.length } });
      return publicBatch(await repository.create({ batch, template: { buffer: snapshot.image.buffer, mimeType: snapshot.image.mimeType }, items }));
    } finally { await Promise.all(files.filter((file) => file.path).map((file) => unlink(file.path).catch(() => {}))); }
  }
  async function list() { return (await repository.list()).map((batch) => publicBatch(batch, { includeEvents: false })); }
  async function get(id) { return publicBatch(await repository.get(id)); }
  async function start(id, { confirmPaid } = {}) {
    if (!confirmPaid) throw new AppError('CREDIT_CONFIRMATION_REQUIRED', 'Confirme o uso de créditos antes de iniciar o lote.', { status: 400 });
    const current = await repository.get(id);
    if (!current.templatePrompt?.trim()) {
      throw new AppError('BATCH_TEMPLATE_PROFILE_INCOMPLETE', 'Este lote foi criado antes dos perfis de geração por Template. Cancele-o e crie um novo lote com um Template configurado.', { status: 422 });
    }
    const batch = await repository.update(id, (next) => {
      if (!['ready', 'paused', 'interrupted'].includes(next.status) || !next.items.some((i) => i.status === 'queued')) throw new AppError('BATCH_NOT_STARTABLE', 'Este lote não possui itens pendentes para iniciar.', { status: 409 });
      const fromStatus = next.status;
      next.status = 'running'; next.pauseRequested = false; next.cancelRequested = false; next.startedAt ||= iso();
      record(next, fromStatus === 'ready' ? 'batch_started' : 'batch_resumed', { fromStatus, toStatus: 'running' });
      return next;
    });
    queue?.enqueue(id);
    return publicBatch(batch);
  }
  async function pause(id) { return publicBatch(await repository.update(id, (next) => {
    if (next.status !== 'running') throw new AppError('BATCH_NOT_RUNNING', 'O lote não está em execução.', { status: 409 });
    if (!next.pauseRequested) record(next, 'pause_requested', { fromStatus: 'running', toStatus: 'running' });
    next.pauseRequested = true;
    if (!next.items.some((item) => ['preparing', 'generating'].includes(item.status))) {
      next.status = 'paused';
      record(next, 'batch_paused', { fromStatus: 'running', toStatus: 'paused' });
    }
    return next;
  })); }
  async function resume(id) { return start(id, { confirmPaid: true }); }
  async function cancel(id) { return publicBatch(await repository.update(id, (next) => {
    if (!['ready', 'running', 'paused', 'interrupted'].includes(next.status)) throw new AppError('BATCH_NOT_CANCELLABLE', 'Este lote não pode mais ser cancelado.', { status: 409 });
    if (!next.cancelRequested) record(next, 'cancel_requested', { fromStatus: next.status, toStatus: next.status });
    next.cancelRequested = true;
    for (const item of next.items) if (item.status === 'queued') cancelItem(next, item, iso);
    if (!next.items.some((item) => ['preparing', 'generating'].includes(item.status))) finishCancellation(next, iso, record);
    return next;
  })); }
  async function prepareNext(id) { return repository.update(id, (next) => {
    if (next.cancelRequested) { finishCancellation(next, iso, record); return next; }
    if (next.pauseRequested) {
      if (next.status !== 'paused') { const fromStatus = next.status; next.status = 'paused'; record(next, 'batch_paused', { fromStatus, toStatus: 'paused' }); }
      return next;
    }
    const item = next.items.find((candidate) => candidate.status === 'queued');
    if (!item) { finish(next, iso, record); return next; }
    item.status = 'preparing'; item.updatedAt = iso(); next.status = 'running'; next._preparedItemId = item.id;
    record(next, 'item_preparing', { itemId: item.id, fromStatus: 'queued', toStatus: 'preparing' });
    return next;
  }).then((batch) => batch._preparedItemId ? { batch, item: batch.items.find((i) => i.id === batch._preparedItemId) } : null); }
  async function beginPrepared(id, itemId) { return repository.update(id, (next) => {
    delete next._preparedItemId;
    const item = next.items.find((candidate) => candidate.id === itemId);
    if (!item || item.status !== 'preparing' || next.pauseRequested || next.cancelRequested) {
      if (item?.status === 'preparing') {
        if (next.cancelRequested) cancelItem(next, item, iso);
        else {
          item.status = 'queued';
          item.updatedAt = iso();
          record(next, 'item_requeued', {
            itemId: item.id,
            fromStatus: 'preparing',
            toStatus: 'queued',
            data: { reason: 'pause_requested' },
          });
        }
      }
      if (next.cancelRequested) finishCancellation(next, iso, record);
      else if (next.pauseRequested && next.status !== 'paused') { const fromStatus = next.status; next.status = 'paused'; record(next, 'batch_paused', { fromStatus, toStatus: 'paused' }); }
      return next;
    }
    item.status = 'generating'; item.attempts = 1; item.startedAt = iso(); item.updatedAt = iso();
    record(next, 'item_generation_started', { itemId, fromStatus: 'preparing', toStatus: 'generating' });
    return next;
  }).then((batch) => batch.items.find((item) => item.id === itemId)?.status === 'generating'); }
  async function executionInput(id, itemId) { const batch = await repository.get(id); const item = batch.items.find((candidate) => candidate.id === itemId); if (!item) throw new AppError('BATCH_ITEM_NOT_FOUND', 'O item do lote não foi encontrado.', { status: 404 }); const garment = await repository.readGarment(id, itemId); const templateSnapshot = await repository.readTemplate(id); return { templateSnapshot, additionalInstruction: batch.additionalInstruction ?? null, garmentFile: { buffer: garment.buffer, mimetype: garment.mimeType, originalname: garment.originalname, size: garment.size } }; }
  async function complete(id, itemId, result) { return repository.update(id, (next) => {
    const item = requireItem(next, itemId); const fromStatus = item.status;
    item.status = 'completed'; item.resultId = result.generationId; item.costUsd = result.metrics.costUsd; item.durationMs = result.metrics.durationMs; item.providerRequestId = result.requestId || null; item.completedAt = iso(); item.updatedAt = iso();
    record(next, 'item_completed', { itemId, fromStatus, toStatus: 'completed', data: { resultId: item.resultId, providerRequestId: item.providerRequestId || undefined, costUsd: item.costUsd, durationMs: item.durationMs } });
    finish(next, iso, record); return next;
  }); }
  async function fail(id, itemId, error) { return repository.update(id, (next) => {
    const item = requireItem(next, itemId); const fromStatus = item.status;
    item.status = 'failed'; item.safeError = { code: error?.code || 'GENERATION_FAILED', message: error?.message || 'A geração deste item falhou.' }; item.completedAt = iso(); item.updatedAt = iso();
    record(next, 'item_failed', { itemId, fromStatus, toStatus: 'failed', data: { errorCode: item.safeError.code } });
    finish(next, iso, record); return next;
  }); }
  async function recoverInterruptedItems({ resultStorage } = {}) {
    if (!resultStorage?.listEntries || !resultStorage?.readAsset) return { recovered: 0 };

    const candidatesByItem = new Map();
    const invalidMetadataByItem = new Map();
    const incorrectAssociationsByBatch = new Map();
    for (const entry of await resultStorage.listEntries()) {
      const metadata = entry?.metadata;
      if (!isRecoveryCandidate(metadata)) {
        if (hasRecoveryAssociation(metadata)) {
          const key = recoveryKey(metadata.batchId, metadata.batchItemId);
          invalidMetadataByItem.set(key, (invalidMetadataByItem.get(key) || 0) + 1);
        } else if (typeof metadata?.batchId === 'string' && isSafeRecoveryId(metadata.batchId)) {
          incorrectAssociationsByBatch.set(metadata.batchId, (incorrectAssociationsByBatch.get(metadata.batchId) || 0) + 1);
        }
        continue;
      }
      const key = recoveryKey(metadata.batchId, metadata.batchItemId);
      const candidates = candidatesByItem.get(key) || [];
      candidates.push(metadata);
      candidatesByItem.set(key, candidates);
    }

    let recovered = 0;
    for (const batch of await repository.list()) {
      const matches = [];
      const diagnostics = [];
      const incorrectAssociations = incorrectAssociationsByBatch.get(batch.id) || 0;
      if (incorrectAssociations) diagnostics.push({ type: 'recovery_ignored_incorrect_association', data: { reason: 'batch_item_invalid', count: incorrectAssociations } });
      for (const item of batch.items || []) {
        if (item.status !== 'interrupted') continue;
        const key = recoveryKey(batch.id, item.id);
        const invalidMetadata = invalidMetadataByItem.get(key) || 0;
        if (invalidMetadata) diagnostics.push({ type: 'recovery_ignored_invalid_metadata', itemId: item.id, data: { reason: 'metadata_invalid', count: invalidMetadata } });
        const candidates = candidatesByItem.get(key);
        if (!candidates) continue;
        if (candidates.length !== 1) {
          diagnostics.push({ type: 'recovery_ignored_conflict', itemId: item.id, data: { reason: 'multiple_candidates', count: candidates.length } });
          continue;
        }
        const [metadata] = candidates;
        try {
          const asset = await resultStorage.readAsset(metadata.id, 'result');
          if (!isValidRecoveryAsset(asset)) {
            diagnostics.push({ type: 'recovery_ignored_invalid_asset', itemId: item.id, data: { reason: 'asset_invalid', resultId: metadata.id } });
            continue;
          }
          matches.push({ itemId: item.id, metadata });
        } catch {
          diagnostics.push({ type: 'recovery_ignored_invalid_asset', itemId: item.id, data: { reason: 'asset_unavailable', resultId: metadata.id } });
          // Sem asset local válido, o item permanece interrupted e nunca é reenfileirado automaticamente.
        }
      }
      if (!matches.length && !diagnostics.length) continue;
      await repository.update(batch.id, (next) => {
        for (const diagnostic of diagnostics) record(next, diagnostic.type, diagnostic);
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
          record(next, 'item_result_recovered', { itemId, fromStatus: 'interrupted', toStatus: 'completed', data: { resultId: metadata.id, providerRequestId: item.providerRequestId || undefined, costUsd: item.costUsd, durationMs: item.durationMs } });
          recovered += 1;
        }
        finish(next, iso, record);
        return next;
      });
    }
    return { recovered };
  }
  return Object.freeze({ create, list, get, start, pause, resume, cancel, prepareNext, beginPrepared, executionInput, complete, fail, recoverInterruptedItems, setQueue: (value) => { queue = value; } });
}
function recoveryKey(batchId, batchItemId) { return `${batchId}\u0000${batchItemId}`; }
function isRecoveryCandidate(metadata) { return Boolean(metadata && metadata.status === 'success' && validIso(metadata.createdAt) && isSafeRecoveryId(metadata.id) && hasRecoveryAssociation(metadata) && hasValidRecoveryNumbers(metadata)); }
function hasRecoveryAssociation(metadata) { return Boolean(typeof metadata?.batchId === 'string' && typeof metadata?.batchItemId === 'string' && isSafeRecoveryId(metadata.batchId) && isSafeRecoveryId(metadata.batchItemId)); }
function isSafeRecoveryId(value) { return /^[a-zA-Z0-9-]+$/.test(value); }
function isValidRecoveryAsset(asset) { return Boolean(asset?.buffer?.length && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)); }
function hasValidRecoveryNumbers(metadata) { return isOptionalNonNegativeFinite(metadata.costUsd) && isOptionalNonNegativeFinite(metadata.durationMs); }
function isOptionalNonNegativeFinite(value) { return value == null || (typeof value === 'number' && Number.isFinite(value) && value >= 0); }
function validIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function requireItem(batch, id) { const item = batch.items.find((candidate) => candidate.id === id); if (!item) throw new AppError('BATCH_ITEM_NOT_FOUND', 'O item do lote não foi encontrado.', { status: 404 }); return item; }
function cancelItem(batch, item, iso) { const fromStatus = item.status; item.status = 'cancelled'; item.updatedAt = iso(); item.completedAt = iso(); appendBatchEvent(batch, { type: 'item_cancelled', at: iso(), itemId: item.id, fromStatus, toStatus: 'cancelled' }); }
function finishCancellation(batch, iso, record) {
  for (const item of batch.items) if (item.status === 'queued' || item.status === 'preparing') cancelItem(batch, item, iso);
  if (!batch.items.some((item) => item.status === 'generating') && batch.status !== 'cancelled') {
    const fromStatus = batch.status; batch.status = 'cancelled'; batch.completedAt = iso(); record(batch, 'batch_cancelled', { fromStatus, toStatus: 'cancelled' });
  }
  summarize(batch);
}
function finish(batch, iso, record) {
  summarize(batch);
  if (batch.cancelRequested) return finishCancellation(batch, iso, record);
  if (batch.pauseRequested) {
    if (batch.status !== 'paused') { const fromStatus = batch.status; batch.status = 'paused'; record(batch, 'batch_paused', { fromStatus, toStatus: 'paused' }); }
    return;
  }
  if (batch.items.some((item) => ['queued', 'preparing', 'generating'].includes(item.status))) return;
  const nextStatus = batch.failedItems || batch.cancelledItems || batch.interruptedItems ? 'completed_with_errors' : 'completed';
  if (batch.status !== nextStatus) { const fromStatus = batch.status; batch.status = nextStatus; batch.completedAt = iso(); record(batch, 'batch_completed', { fromStatus, toStatus: nextStatus }); }
}
function publicBatch(batch, { includeEvents = true } = {}) { const clean = JSON.parse(JSON.stringify(batch)); delete clean.templateStorageKey; delete clean._preparedItemId; if (!includeEvents) delete clean.events; for (const item of clean.items || []) delete item.garmentStorageKey; return clean; }
