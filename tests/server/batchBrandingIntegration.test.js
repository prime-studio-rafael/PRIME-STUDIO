import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createLocalBatchRepository } from '../../server/repositories/localBatchRepository.js';
import { createBatchService } from '../../server/services/batchService.js';
import { createBatchQueue } from '../../server/services/batchQueue.js';
import { createGenerationCoordinator } from '../../server/services/generationCoordinator.js';
import { createGenerationExecutor } from '../../server/services/generationExecutor.js';
import { createLocalResultStorage } from '../../server/storage/localResultStorage.js';
import { createLocalBrandingStorage } from '../../server/storage/localBrandingStorage.js';
import { createBrandingService } from '../../server/services/brandingService.js';

const templateSource = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function logoPngBuffer() {
  return sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: 240, height: 240, channels: 4, background: { r: 220, g: 20, b: 20, alpha: 1 } } }).png().toBuffer(), gravity: 'center' }])
    .png()
    .toBuffer();
}

async function fixture({ brandingEnabled }) {
  const directory = await mkdtemp(path.join(tmpdir(), 'prime-batch-branding-'));
  directories.push(directory);
  const templateBuffer = await readFile(templateSource);
  const snapshot = { publicTemplate: { id: 'model-01', label: 'Modelo 01', category: 'moda-masculina', prompt: 'Edite exclusivamente o item-alvo desta categoria.', negativePrompt: null, provider: 'openrouter', modelId: null, generationAspectRatio: null, resolution: null, promptVersion: 'template-00000001' }, image: { buffer: templateBuffer, mimeType: 'image/jpeg', dimensions: { width: 773, height: 1024 } } };
  const repository = createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') });
  const batchService = createBatchService({ repository, templateService: { getForGeneration: async () => snapshot } });

  const generatedImage = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 30, g: 30, b: 30 } } }).jpeg().toBuffer();
  const openRouterClient = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: generatedImage.toString('base64'), media_type: 'image/jpeg' }], usage: { cost: 0.034 } }, requestId: 'batch-request-1' })) };

  const brandingStorage = createLocalBrandingStorage({ brandingDirectory: path.join(directory, 'branding') });
  const brandingService = createBrandingService({ storage: brandingStorage });
  if (brandingEnabled) {
    await brandingService.uploadLogo({ buffer: await logoPngBuffer(), mimetype: 'image/png', originalname: 'logo.png' });
    await brandingService.approveLogo();
    await brandingService.setConfig({ enabled: true });
  }

  const resultStorage = createLocalResultStorage({ resultsDir: path.join(directory, 'results') });
  const executor = createGenerationExecutor({ openRouterClient, resultStorage, templateService: { getForGeneration: async () => snapshot }, brandingService });
  const coordinator = createGenerationCoordinator();
  createBatchQueue({ batchService, executor, coordinator });

  return { directory, templateBuffer, batchService, resultStorage, openRouterClient };
}

// Fase 3 do perfil completo de geração por Template: o snapshot do lote agora congela o perfil
// completo do Template (prompt/negativePrompt/provider/modelId/generationAspectRatio/resolution/
// promptVersion/category), então a execução real de um lote volta a funcionar — restaurando a
// cobertura de Branding em lote que a Fase 2 havia deixado temporariamente indisponível (snapshots
// legados, sem perfil, continuam bloqueados — ver describe dedicado mais abaixo).
describe('batch queue — Branding integration (shared executor, no pipeline duplication)', () => {
  it('applies the logo to batch items when Branding is enabled, with exactly one provider call per item', async () => {
    const { templateBuffer, batchService, resultStorage, openRouterClient } = await fixture({ brandingEnabled: true });
    const batch = await batchService.create({ name: 'Lote com branding', templateId: 'model-01', files: [{ buffer: templateBuffer, mimetype: 'image/jpeg', originalname: 'roupa.jpeg' }] });
    await batchService.start(batch.id, { confirmPaid: true });
    await vi.waitFor(async () => expect((await batchService.get(batch.id)).status).toBe('completed'));
    const finished = await batchService.get(batch.id);
    expect(finished.items[0].status).toBe('completed');
    const resultId = finished.items[0].resultId;
    const entry = await resultStorage.findById(resultId);
    expect(entry.metadata.logoApplied).toBe(true);
    expect(entry.metadata.brandingStatus).toBe('applied');
    expect(entry.assets.branded).toBeTruthy();
    expect(openRouterClient.generate).toHaveBeenCalledTimes(1); // uma chamada, independentemente do branding
  });

  it('does not apply any logo to batch items when Branding is disabled, preserving prior behaviour', async () => {
    const { templateBuffer, batchService, resultStorage, openRouterClient } = await fixture({ brandingEnabled: false });
    const batch = await batchService.create({ name: 'Lote sem branding', templateId: 'model-01', files: [{ buffer: templateBuffer, mimetype: 'image/jpeg', originalname: 'roupa.jpeg' }] });
    await batchService.start(batch.id, { confirmPaid: true });
    await vi.waitFor(async () => expect((await batchService.get(batch.id)).status).toBe('completed'));
    const finished = await batchService.get(batch.id);
    const resultId = finished.items[0].resultId;
    const entry = await resultStorage.findById(resultId);
    expect(entry.metadata.logoApplied).toBe(false);
    expect(entry.metadata.brandingStatus).toBe('disabled');
    expect(entry.assets.branded).toBeNull();
    expect(openRouterClient.generate).toHaveBeenCalledTimes(1);
  });
});

// Snapshot legado (schema anterior à Fase 3, sem o perfil completo) — construído diretamente pelo
// repositório real, sem passar pela validação de criação (que já bloquearia um Template incompleto
// hoje), para simular fielmente um lote já existente em disco antes desta melhoria.
describe('batch queue — legacy snapshot without a generation profile is rejected safely', () => {
  it('rejects a legacy batch snapshot before any provider call, without a generic fallback, and keeps the batch cancellable', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'prime-batch-legacy-'));
    directories.push(directory);
    const templateBuffer = await readFile(templateSource);
    const repository = createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') });
    const legacyBatch = {
      id: '00000000-0000-4000-8000-000000000001', name: 'Lote legado', templateId: 'model-01', templateLabel: 'Modelo 01',
      status: 'ready', totalItems: 0, completedItems: 0, failedItems: 0, cancelledItems: 0, interruptedItems: 0,
      estimatedCostUsd: 0.034, actualCostUsd: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      startedAt: null, completedAt: null, pauseRequested: false, cancelRequested: false,
    };
    const items = [{ id: '00000000-0000-4000-8000-000000000002', originalFileName: 'roupa.jpeg', garmentMime: 'image/jpeg', garmentDimensions: { width: 773, height: 1024 }, sizeBytes: templateBuffer.length, status: 'queued', resultId: null, costUsd: null, durationMs: null, providerRequestId: null, safeError: null, attempts: 0, createdAt: legacyBatch.createdAt, updatedAt: legacyBatch.updatedAt, startedAt: null, completedAt: null, buffer: templateBuffer }];
    await repository.create({ batch: legacyBatch, template: { buffer: templateBuffer, mimeType: 'image/jpeg' }, items });

    const openRouterClient = { generate: vi.fn() };
    const executor = createGenerationExecutor({ openRouterClient, resultStorage: { save: vi.fn() }, templateService: { getForGeneration: vi.fn() } });
    const coordinator = createGenerationCoordinator();
    const batchService = createBatchService({ repository, templateService: { getForGeneration: vi.fn() } });
    createBatchQueue({ batchService, executor, coordinator });

    await expect(batchService.start(legacyBatch.id, { confirmPaid: true })).rejects.toMatchObject({ code: 'BATCH_TEMPLATE_PROFILE_INCOMPLETE', status: 422 });
    expect(openRouterClient.generate).not.toHaveBeenCalled();

    const stillReady = await batchService.get(legacyBatch.id);
    expect(stillReady.status).toBe('ready'); // nunca entrou em "running"
    const cancelled = await batchService.cancel(legacyBatch.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('keeps a completed legacy batch fully readable, without depending on a new execution', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'prime-batch-legacy-completed-'));
    directories.push(directory);
    const templateBuffer = await readFile(templateSource);
    const repository = createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') });
    const legacyBatch = {
      id: '00000000-0000-4000-8000-000000000003', name: 'Lote legado concluído', templateId: 'model-01', templateLabel: 'Modelo 01',
      status: 'completed', totalItems: 1, completedItems: 1, failedItems: 0, cancelledItems: 0, interruptedItems: 0,
      estimatedCostUsd: 0.034, actualCostUsd: 0.034, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), pauseRequested: false, cancelRequested: false,
    };
    const items = [{ id: '00000000-0000-4000-8000-000000000004', originalFileName: 'roupa.jpeg', garmentMime: 'image/jpeg', garmentDimensions: { width: 773, height: 1024 }, sizeBytes: templateBuffer.length, status: 'completed', resultId: 'legacy-result-1', costUsd: 0.034, durationMs: 900, providerRequestId: 'legacy-request-1', safeError: null, attempts: 1, createdAt: legacyBatch.createdAt, updatedAt: legacyBatch.updatedAt, startedAt: legacyBatch.startedAt, completedAt: legacyBatch.completedAt, buffer: templateBuffer }];
    await repository.create({ batch: legacyBatch, template: { buffer: templateBuffer, mimeType: 'image/jpeg' }, items });

    const batchService = createBatchService({ repository, templateService: { getForGeneration: vi.fn() } });
    const read = await batchService.get(legacyBatch.id);
    expect(read.status).toBe('completed');
    expect(read.items[0]).toMatchObject({ status: 'completed', resultId: 'legacy-result-1' });
  });
});
