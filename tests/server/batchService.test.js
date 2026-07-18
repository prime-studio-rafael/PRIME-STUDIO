import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { createLocalBatchRepository } from '../../server/repositories/localBatchRepository.js';
import { createBatchService } from '../../server/services/batchService.js';
import { createBatchQueue } from '../../server/services/batchQueue.js';
import { createGenerationCoordinator } from '../../server/services/generationCoordinator.js';

const source = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const directories = [];
const COMPLETE_TEMPLATE = { id: 'model-01', label: 'Modelo 01', category: 'moda-masculina', prompt: 'Edite exclusivamente o item-alvo desta categoria.', negativePrompt: 'Não incluir estampas extras.', provider: 'openrouter', modelId: 'nano-banana-lite', generationAspectRatio: '1:1', resolution: '1K', promptVersion: 'template-00000001' };

async function fixture({ publicTemplate = COMPLETE_TEMPLATE } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'prime-batch-')); directories.push(directory);
  const buffer = await readFile(source); const snapshot = { publicTemplate, image: { buffer, mimeType: 'image/jpeg', dimensions: { width: 773, height: 1024 } } };
  const repository = createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') });
  const getForGeneration = vi.fn(async () => snapshot);
  const service = createBatchService({ repository, templateService: { getForGeneration }, uuid: (() => { let i = 0; return () => `00000000-0000-4000-8000-00000000000${++i}`; })() });
  return { directory, buffer, repository, service, getForGeneration };
}
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe('BatchService local', () => {
  it('creates a persisted ready batch and rejects duplicate upload bytes', async () => {
    const { buffer, service } = await fixture();
    const file = { buffer, mimetype: 'image/jpeg', originalname: 'blusa.jpeg' };
    const batch = await service.create({ name: 'Coleção teste', templateId: 'model-01', files: [file] });
    expect(batch).toMatchObject({ status: 'ready', totalItems: 1, estimatedCostUsd: 0.034 });
    expect(batch.items[0]).not.toHaveProperty('buffer');
    await expect(service.create({ name: 'Duplicado', templateId: 'model-01', files: [file, { ...file, originalname: 'igual.jpeg' }] })).rejects.toMatchObject({ code: 'DUPLICATE_BATCH_FILE' });
  });

  it('processes items one at a time through the shared coordinator', async () => {
    const { buffer, service } = await fixture();
    const batch = await service.create({ name: 'Sequência', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] });
    const executor = { execute: vi.fn(async () => ({ generationId: 'result-1', metrics: { costUsd: 0.034, durationMs: 8 }, requestId: 'request-1' })) };
    const coordinator = createGenerationCoordinator(); createBatchQueue({ batchService: service, executor, coordinator });
    await service.start(batch.id, { confirmPaid: true });
    await vi.waitFor(async () => expect((await service.get(batch.id)).status).toBe('completed'));
    const finished = await service.get(batch.id);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(finished.items[0]).toMatchObject({ status: 'completed', attempts: 1, resultId: 'result-1', providerRequestId: 'request-1' });
  });

  it('freezes the full generation profile snapshot into batch.json, including additionalInstruction', async () => {
    const { buffer, service, repository } = await fixture();
    const batch = await service.create({ name: 'Perfil completo', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }], additionalInstruction: '  Aplicar acabamento fosco.  ' });
    expect(batch).toMatchObject({
      templateId: 'model-01', templateLabel: 'Modelo 01', templateCategory: 'moda-masculina',
      templatePrompt: COMPLETE_TEMPLATE.prompt, templateNegativePrompt: COMPLETE_TEMPLATE.negativePrompt,
      templateProvider: 'openrouter', templateModelId: 'nano-banana-lite', templateGenerationAspectRatio: '1:1', templateResolution: '1K',
      templatePromptVersion: 'template-00000001', additionalInstruction: 'Aplicar acabamento fosco.',
    });
    const raw = JSON.parse(await readFile(path.join(repository.paths.batchesDirectory, batch.id, 'batch.json'), 'utf8'));
    expect(raw).toMatchObject({ templatePrompt: COMPLETE_TEMPLATE.prompt, additionalInstruction: 'Aplicar acabamento fosco.' });
  });

  it('blocks creation when the Template has no prompt configured, without persisting any file', async () => {
    const { buffer, service, repository } = await fixture({ publicTemplate: { ...COMPLETE_TEMPLATE, prompt: null, promptVersion: null } });
    await expect(service.create({ name: 'Tenis 9060', templateId: 'tenis-9060', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] }))
      .rejects.toMatchObject({ code: 'BATCH_TEMPLATE_PROFILE_INCOMPLETE', status: 422 });
    const entries = await readdir(repository.paths.batchesDirectory).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
    expect(entries).toEqual([]);
  });

  it('rejects an additionalInstruction longer than 500 characters, and accepts exactly 500', async () => {
    const { buffer, service } = await fixture();
    const file = { buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' };
    await expect(service.create({ name: 'Muito longa', templateId: 'model-01', files: [file], additionalInstruction: 'x'.repeat(501) }))
      .rejects.toMatchObject({ code: 'ADDITIONAL_INSTRUCTION_TOO_LONG', status: 422 });
    const accepted = await service.create({ name: 'No limite', templateId: 'model-01', files: [file], additionalInstruction: 'x'.repeat(500) });
    expect(accepted.additionalInstruction).toHaveLength(500);
  });

  it('keeps the frozen snapshot unchanged even if the Template is edited afterwards', async () => {
    const { buffer, service, getForGeneration } = await fixture();
    const batch = await service.create({ name: 'Congelado', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] });
    getForGeneration.mockResolvedValue({ publicTemplate: { ...COMPLETE_TEMPLATE, prompt: 'Prompt totalmente diferente, editado depois.' }, image: { buffer, mimeType: 'image/jpeg', dimensions: { width: 773, height: 1024 } } });
    const reread = await service.get(batch.id);
    expect(reread.templatePrompt).toBe(COMPLETE_TEMPLATE.prompt);
  });

  it('blocks resume for a batch whose snapshot has no prompt, without enqueueing or touching the coordinator lock', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'prime-batch-legacy-resume-')); directories.push(directory);
    const buffer = await readFile(source);
    const rawRepository = createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') });
    // Simula um lote gravado antes da Fase 3 (sem os campos de perfil), inserindo diretamente via o repositório real.
    const legacyBatch = { id: '00000000-0000-4000-8000-000000000099', name: 'Legado', templateId: 'model-01', templateLabel: 'Modelo 01', status: 'paused', totalItems: 1, completedItems: 0, failedItems: 0, cancelledItems: 0, interruptedItems: 0, estimatedCostUsd: 0.034, actualCostUsd: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), startedAt: null, completedAt: null, pauseRequested: false, cancelRequested: false };
    const items = [{ id: '00000000-0000-4000-8000-000000000098', originalFileName: 'a.jpeg', garmentMime: 'image/jpeg', garmentDimensions: { width: 773, height: 1024 }, sizeBytes: buffer.length, status: 'queued', resultId: null, costUsd: null, durationMs: null, providerRequestId: null, safeError: null, attempts: 0, createdAt: legacyBatch.createdAt, updatedAt: legacyBatch.updatedAt, startedAt: null, completedAt: null, buffer }];
    await rawRepository.create({ batch: legacyBatch, template: { buffer, mimeType: 'image/jpeg' }, items });

    const legacyService = createBatchService({ repository: createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') }), templateService: { getForGeneration: vi.fn() } });
    const enqueueSpy = vi.fn();
    legacyService.setQueue({ enqueue: enqueueSpy });
    await expect(legacyService.resume(legacyBatch.id)).rejects.toMatchObject({ code: 'BATCH_TEMPLATE_PROFILE_INCOMPLETE', status: 422 });
    expect(enqueueSpy).not.toHaveBeenCalled();
    expect((await legacyService.get(legacyBatch.id)).status).toBe('paused');
  });
});
