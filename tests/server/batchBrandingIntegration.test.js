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
  const openRouterClient = { generate: async () => ({ body: { data: [{ b64_json: generatedImage.toString('base64'), media_type: 'image/jpeg' }], usage: { cost: 0.034 } }, requestId: 'batch-request-1' }) };

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

describe('batch queue — Branding integration (shared executor, no pipeline duplication)', () => {
  it('applies the logo to batch items when Branding is enabled, with exactly one provider call per item', async () => {
    const { templateBuffer, batchService, resultStorage } = await fixture({ brandingEnabled: true });
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
  });

  it('does not apply any logo to batch items when Branding is disabled, preserving prior behaviour', async () => {
    const { templateBuffer, batchService, resultStorage } = await fixture({ brandingEnabled: false });
    const batch = await batchService.create({ name: 'Lote sem branding', templateId: 'model-01', files: [{ buffer: templateBuffer, mimetype: 'image/jpeg', originalname: 'roupa.jpeg' }] });
    await batchService.start(batch.id, { confirmPaid: true });
    await vi.waitFor(async () => expect((await batchService.get(batch.id)).status).toBe('completed'));
    const finished = await batchService.get(batch.id);
    const resultId = finished.items[0].resultId;
    const entry = await resultStorage.findById(resultId);
    expect(entry.metadata.logoApplied).toBe(false);
    expect(entry.metadata.brandingStatus).toBe('disabled');
    expect(entry.assets.branded).toBeNull();
  });
});
