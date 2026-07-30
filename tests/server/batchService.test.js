import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { createLocalBatchRepository } from '../../server/repositories/localBatchRepository.js';
import { createBatchService } from '../../server/services/batchService.js';
import { createBatchQueue } from '../../server/services/batchQueue.js';
import { createGenerationCoordinator } from '../../server/services/generationCoordinator.js';

const source = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const sourceTwo = new URL('../../public/templates/model-02.jpeg', import.meta.url);
const sourceThree = new URL('../../public/templates/model-01-legacy-q70.jpeg', import.meta.url);
const sourceFour = new URL('../../public/templates/model-02-legacy-q70.jpeg', import.meta.url);
const sourceFive = new URL('../../public/templates/model-01%20-%20co%CC%81pia.png', import.meta.url);
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
    expect(batch.events).toMatchObject([{ type: 'batch_created', itemId: null, data: { count: 1 } }]);
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
    expect(finished.events.map((event) => event.type)).toEqual(['batch_created', 'batch_started', 'item_preparing', 'item_generation_started', 'item_completed', 'batch_completed']);
    expect((await service.list())[0]).not.toHaveProperty('events');
  });

  it('records a single preparing-to-queued event when a pause happens before generation starts', async () => {
    const { buffer, service, repository } = await fixture();
    const batch = await service.create({ name: 'Pausa antes da geração', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] });
    await service.start(batch.id, { confirmPaid: true });
    const prepared = await service.prepareNext(batch.id);
    await service.pause(batch.id);
    expect(await service.beginPrepared(batch.id, prepared.item.id)).toBe(false);

    const persisted = await service.get(batch.id);
    expect(persisted.status).toBe('paused');
    expect(persisted.items[0]).toMatchObject({ status: 'queued' });
    expect(persisted.events.filter((event) => event.type === 'item_requeued')).toEqual([
      expect.objectContaining({ itemId: prepared.item.id, fromStatus: 'preparing', toStatus: 'queued', data: { reason: 'pause_requested' } }),
    ]);

    const directory = path.join(repository.paths.batchesDirectory, batch.id);
    const [primary, backup] = await Promise.all(['batch.json', 'batch.json.bak'].map(async (file) => JSON.parse(await readFile(path.join(directory, file), 'utf8'))));
    for (const persistedFile of [primary, backup]) {
      expect(persistedFile.items[0].status).toBe('queued');
      expect(persistedFile.events.filter((event) => event.type === 'item_requeued')).toHaveLength(1);
    }
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

  it('keeps completed, failed, cancelled and queued items intact while marking active work interrupted after restart', async () => {
    const { buffer, service, repository, directory } = await fixture();
    const [bufferTwo, bufferThree, bufferFour, bufferFive] = await Promise.all([sourceTwo, sourceThree, sourceFour, sourceFive].map((file) => readFile(file)));
    const batch = await service.create({ name: 'Reinício seguro', templateId: 'model-01', files: [
      { buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' },
      { buffer: bufferTwo, mimetype: 'image/jpeg', originalname: 'b.jpeg' },
      { buffer: bufferThree, mimetype: 'image/jpeg', originalname: 'c.jpeg' },
      { buffer: bufferFour, mimetype: 'image/jpeg', originalname: 'd.jpeg' },
      { buffer: bufferFive, mimetype: 'image/png', originalname: 'e.png' },
    ] });
    await repository.update(batch.id, (next) => {
      next.status = 'running';
      [next.items[0].status, next.items[1].status, next.items[2].status, next.items[3].status, next.items[4].status] = ['completed', 'failed', 'cancelled', 'queued', 'generating'];
      return next;
    });

    const restarted = createBatchService({ repository: createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') }), templateService: { getForGeneration: vi.fn() } });
    const recovered = await restarted.get(batch.id);
    expect(recovered.status).toBe('interrupted');
    expect(recovered.items.map((item) => item.status)).toEqual(['completed', 'failed', 'cancelled', 'queued', 'interrupted']);
    expect(recovered.events.map((event) => event.type)).toEqual(['batch_created', 'batch_interrupted', 'item_interrupted']);
  });

  it('reconciles exactly one valid persisted result for an interrupted item and remains idempotent', async () => {
    const { buffer, service, repository } = await fixture();
    const batch = await service.create({ name: 'Resultado recuperável', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] });
    await repository.update(batch.id, (next) => { next.status = 'interrupted'; next.items[0].status = 'interrupted'; return next; });
    const metadata = { id: 'result-recovered', status: 'success', batchId: batch.id, batchItemId: batch.items[0].id, costUsd: 0.034, durationMs: 8_000, providerRequestId: 'request-recovered', createdAt: '2026-07-30T12:00:00.000Z' };
    const resultStorage = { listEntries: vi.fn(async () => [{ metadata }]), readAsset: vi.fn(async () => ({ buffer: Buffer.from('valid-image'), mimeType: 'image/webp' })) };

    expect(await service.recoverInterruptedItems({ resultStorage })).toEqual({ recovered: 1 });
    expect((await service.get(batch.id)).items[0]).toMatchObject({ status: 'completed', resultId: 'result-recovered', costUsd: 0.034, durationMs: 8_000, providerRequestId: 'request-recovered' });
    expect((await service.get(batch.id)).events.at(-2)).toMatchObject({ type: 'item_result_recovered', itemId: batch.items[0].id, data: { resultId: 'result-recovered', costUsd: 0.034, durationMs: 8_000 } });
    expect(await service.recoverInterruptedItems({ resultStorage })).toEqual({ recovered: 0 });
    expect(resultStorage.readAsset).toHaveBeenCalledTimes(1);
  });

  it('never reconciles interrupted work from incomplete, mismatched, invalid or conflicting results', async () => {
    const { buffer, service, repository } = await fixture();
    const batch = await service.create({ name: 'Sem suposição', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] });
    await repository.update(batch.id, (next) => { next.status = 'interrupted'; next.items[0].status = 'interrupted'; return next; });
    const itemId = batch.items[0].id;
    let candidateNumber = 0;
    const candidate = (overrides = {}) => ({ metadata: { id: `result-${++candidateNumber}`, status: 'success', createdAt: '2026-07-30T12:00:00.000Z', batchId: batch.id, batchItemId: itemId, ...overrides } });
    const cases = [
      [candidate({ batchItemId: undefined })],
      [candidate({ batchId: 'other-batch' })],
      [candidate({ status: 'incomplete' })],
      [candidate(), candidate()],
      [candidate()],
    ];
    for (const entries of cases) {
      const storage = { listEntries: vi.fn(async () => entries), readAsset: vi.fn(async () => { throw new Error('asset missing'); }) };
      await expect(service.recoverInterruptedItems({ resultStorage: storage })).resolves.toEqual({ recovered: 0 });
      expect((await service.get(batch.id)).items[0]).toMatchObject({ status: 'interrupted', resultId: null });
    }
  });

  it('rejects malformed recovered numeric metadata without changing an interrupted item', async () => {
    const { buffer, service, repository } = await fixture();
    const batch = await service.create({ name: 'Números não confiáveis', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] });
    await repository.update(batch.id, (next) => { next.status = 'interrupted'; next.items[0].status = 'interrupted'; return next; });
    const itemId = batch.items[0].id;
    const invalidValues = [
      { costUsd: -0.01 }, { durationMs: -1 }, { costUsd: Number.NaN }, { durationMs: Infinity },
      { costUsd: '0.034' }, { durationMs: '8000' }, { costUsd: {} }, { durationMs: [] }, { costUsd: false },
    ];

    for (const overrides of invalidValues) {
      const resultStorage = {
        listEntries: vi.fn(async () => [{ metadata: { id: 'result-invalid', status: 'success', createdAt: '2026-07-30T12:00:00.000Z', batchId: batch.id, batchItemId: itemId, ...overrides } }]),
        readAsset: vi.fn(),
      };
      expect(await service.recoverInterruptedItems({ resultStorage })).toEqual({ recovered: 0 });
      expect(resultStorage.readAsset).not.toHaveBeenCalled();
      expect((await service.get(batch.id)).items[0]).toMatchObject({ status: 'interrupted', resultId: null });
    }
  });

  it('accepts absent numeric metadata and zero values when recovering a valid result', async () => {
    const { buffer, service, repository } = await fixture();
    const batch = await service.create({ name: 'Números válidos', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] });
    const itemId = batch.items[0].id;
    const resultStorage = {
      listEntries: vi.fn(async () => [{ metadata: { id: 'result-zero', status: 'success', createdAt: '2026-07-30T12:00:00.000Z', batchId: batch.id, batchItemId: itemId, costUsd: 0, durationMs: 0 } }]),
      readAsset: vi.fn(async () => ({ buffer: Buffer.from('valid-image'), mimeType: 'image/webp' })),
    };

    await repository.update(batch.id, (next) => { next.status = 'interrupted'; next.items[0].status = 'interrupted'; return next; });
    expect(await service.recoverInterruptedItems({ resultStorage })).toEqual({ recovered: 1 });
    expect((await service.get(batch.id)).items[0]).toMatchObject({ status: 'completed', costUsd: 0, durationMs: 0 });

    await repository.update(batch.id, (next) => {
      next.status = 'interrupted';
      next.items[0].status = 'interrupted';
      next.items[0].resultId = null;
      next.items[0].costUsd = null;
      next.items[0].durationMs = null;
      return next;
    });
    resultStorage.listEntries.mockResolvedValue([{ metadata: { id: 'result-absent', status: 'success', createdAt: '2026-07-30T12:00:00.000Z', batchId: batch.id, batchItemId: itemId } }]);
    expect(await service.recoverInterruptedItems({ resultStorage })).toEqual({ recovered: 1 });
    expect((await service.get(batch.id)).items[0]).toMatchObject({ status: 'completed', resultId: 'result-absent', costUsd: null, durationMs: null });
  });

  it('records a single safe diagnostic when recovery is ignored and never reenqueues the item', async () => {
    const { buffer, service, repository } = await fixture();
    const batch = await service.create({ name: 'Diagnóstico seguro', templateId: 'model-01', files: [{ buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' }] });
    await repository.update(batch.id, (next) => { next.status = 'interrupted'; next.items[0].status = 'interrupted'; return next; });
    const metadata = { id: 'result-invalid', status: 'success', createdAt: '2026-07-30T12:00:00.000Z', batchId: batch.id, batchItemId: batch.items[0].id, costUsd: '0.034' };
    const resultStorage = { listEntries: vi.fn(async () => [{ metadata }]), readAsset: vi.fn() };

    expect(await service.recoverInterruptedItems({ resultStorage })).toEqual({ recovered: 0 });
    expect(await service.recoverInterruptedItems({ resultStorage })).toEqual({ recovered: 0 });
    const current = await service.get(batch.id);
    expect(current.items[0]).toMatchObject({ status: 'interrupted', resultId: null });
    expect(current.events.filter((event) => event.type === 'recovery_ignored_invalid_metadata')).toHaveLength(1);
    expect(resultStorage.readAsset).not.toHaveBeenCalled();
  });

  it('only enqueues queued items when an interrupted batch is resumed manually', async () => {
    const { buffer, service, repository } = await fixture();
    const bufferTwo = await readFile(sourceTwo);
    const batch = await service.create({ name: 'Retomada manual', templateId: 'model-01', files: [
      { buffer, mimetype: 'image/jpeg', originalname: 'a.jpeg' },
      { buffer: bufferTwo, mimetype: 'image/jpeg', originalname: 'b.jpeg' },
    ] });
    await repository.update(batch.id, (next) => { next.status = 'interrupted'; next.items[0].status = 'interrupted'; next.items[1].status = 'queued'; return next; });
    const enqueue = vi.fn(); service.setQueue({ enqueue });
    await service.resume(batch.id);
    expect(enqueue).toHaveBeenCalledWith(batch.id);
    expect((await service.get(batch.id)).items.map((item) => item.status)).toEqual(['interrupted', 'queued']);
  });
});
