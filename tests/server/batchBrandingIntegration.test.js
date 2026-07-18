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
import { generationConfig } from '../../server/config/generationConfig.js';

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
  const snapshot = { publicTemplate: { id: 'model-01', label: 'Modelo 01' }, image: { buffer: templateBuffer, mimeType: 'image/jpeg', dimensions: { width: 773, height: 1024 } } };
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

// Fase 2 do perfil completo de geração por Template: nenhum templateSnapshot real de lote carrega
// prompt/negativePrompt/provider/modelId/generationAspectRatio/resolution/promptVersion hoje —
// esses campos só serão congelados no snapshot na Fase 3 (batchService.js/localBatchRepository.js
// não foram alterados nesta fase, por instrução explícita). Sem essa evidência persistida, o
// GenerationExecutor agora rejeita todo snapshot incompleto antes de montar qualquer prompt e
// antes de qualquer chamada ao provedor — nunca com um fallback genérico por suposição (a mesma
// falha estrutural já comprovada com o Template "Tenis 9060" na geração individual). Por isso,
// a cobertura real de "Branding aplicado durante a execução de um lote" fica temporariamente
// indisponível via o pipeline completo (batchService → batchQueue → executor) até a Fase 3 entregar
// o snapshot completo — os dois testes abaixo passam a validar o bloqueio seguro em vez disso.
describe('batch queue — Branding integration (shared executor, no pipeline duplication)', () => {
  it('rejects a legacy batch snapshot without a configured prompt, before any provider call or credit consumption — never applies a generic fallback', async () => {
    const { templateBuffer, batchService, openRouterClient } = await fixture({ brandingEnabled: true });
    const batch = await batchService.create({ name: 'Lote com branding', templateId: 'model-01', files: [{ buffer: templateBuffer, mimetype: 'image/jpeg', originalname: 'roupa.jpeg' }] });
    await batchService.start(batch.id, { confirmPaid: true });
    await vi.waitFor(async () => expect((await batchService.get(batch.id)).status).not.toBe('running'));
    const finished = await batchService.get(batch.id);
    expect(finished.items[0].status).toBe('failed');
    expect(finished.items[0].safeError).toMatchObject({ code: 'BATCH_TEMPLATE_PROFILE_INCOMPLETE' });
    expect(finished.items[0].resultId).toBeNull();
    expect(openRouterClient.generate).not.toHaveBeenCalled();
  });

  it('never calls the provider for a legacy batch snapshot, with or without Branding enabled', async () => {
    const { templateBuffer, batchService, openRouterClient } = await fixture({ brandingEnabled: false });
    const batch = await batchService.create({ name: 'Lote sem branding', templateId: 'model-01', files: [{ buffer: templateBuffer, mimetype: 'image/jpeg', originalname: 'roupa.jpeg' }] });
    await batchService.start(batch.id, { confirmPaid: true });
    await vi.waitFor(async () => expect((await batchService.get(batch.id)).status).not.toBe('running'));
    const finished = await batchService.get(batch.id);
    expect(finished.items[0].status).toBe('failed');
    expect(openRouterClient.generate).not.toHaveBeenCalled();
  });
});
