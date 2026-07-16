import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGenerationService } from '../../server/services/generateImage.js';
import { createLocalResultStorage } from '../../server/storage/localResultStorage.js';
import { AppError } from '../../server/utils/errors.js';
import { generationConfig } from '../../server/config/generationConfig.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const responseBase64 = png.toString('base64');
const templateSource = new URL('../../public/templates/model-01.jpeg', import.meta.url);

async function createFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'prime-studio-test-'));
  const templatePath = path.join(directory, 'template.png');
  await writeFile(templatePath, await readFile(templateSource));
  return { directory, templatePath };
}

function createService({ templatePath, openRouterClient, resultStorage, now = () => 1700000000000 } = {}) {
  return createGenerationService({
    openRouterClient,
    resultStorage,
    now,
    templateCatalog: { getTemplateById: () => ({ id: 'model-01', filePath: templatePath }) },
  });
}

let garmentFile;

describe('generation service', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await createFixture();
    const buffer = await readFile(templateSource);
    garmentFile = { buffer, mimetype: 'image/jpeg', size: buffer.length, originalname: 'garment.jpeg' };
  });

  afterEach(async () => {
    await rm(fixture.directory, { recursive: true, force: true });
  });

  it('makes one simulated provider call and saves the result', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: responseBase64, media_type: 'image/png' }], usage: { cost: 0.034 } }, requestId: 'mock-request' })) };
    const resultsDir = path.join(fixture.directory, 'results');
    const storage = createLocalResultStorage({ resultsDir });
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: storage });

    const result = await service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile });

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(result.metrics.costUsd).toBe(0.034);
    expect(result.localSave.saved).toBe(true);
    expect(result.image.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect((await readFile(path.join(resultsDir, result.localSave.imageFilename))).length).toBeGreaterThan(0);
    const metadata = JSON.parse(await readFile(path.join(resultsDir, result.localSave.metadataFilename), 'utf8'));
    expect(metadata).toMatchObject({
      promptVersion: 'upper-garment-v2',
      model: 'google/gemini-3.1-flash-lite-image',
      requestedAspectRatio: '4:5',
      effectiveAspectRatio: '1:1',
      resolution: '1K',
      inputTemplateId: 'model-01',
      inputTemplateMime: 'image/jpeg',
      inputTemplateDimensions: { width: 773, height: 1024 },
      inputGarmentMime: 'image/jpeg',
      inputGarmentDimensions: { width: 773, height: 1024 },
      outputMime: 'image/png',
      outputDimensions: { width: 1, height: 1 },
      providerRequestId: 'mock-request',
      inputTemplateValidation: { status: 'valid', quality: 'acceptable-with-warning', realFormat: 'jpeg', integrityValid: true },
      inputGarmentValidation: { status: 'valid', realFormat: 'jpeg', originalExtension: 'jpeg', integrityValid: true },
      aspectRatioActivation: { status: 'blocked' },
    });
    expect(metadata.configurationId).toMatch(/^[a-f0-9]{12}$/);
    expect(metadata).not.toHaveProperty('garmentFile');
    expect(JSON.stringify(metadata)).not.toContain('base64');
  });

  it('requires paid confirmation', async () => {
    const provider = { generate: vi.fn() };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn() } });

    await expect(service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: false, garmentFile })).rejects.toMatchObject({ code: 'PAID_CONFIRMATION_REQUIRED' });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('rejects an invalid template without calling the provider', async () => {
    const provider = { generate: vi.fn() };
    const service = createGenerationService({ openRouterClient: provider, resultStorage: { save: vi.fn() }, templateCatalog: { getTemplateById: () => null } });

    await expect(service.generate({ templateId: 'missing', modelId: generationConfig.modelId, confirmPaid: true, garmentFile })).rejects.toMatchObject({ code: 'INVALID_TEMPLATE' });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('returns the generated image when local saving fails', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: responseBase64, media_type: 'image/png' }], usage: {} }, requestId: null })) };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn(async () => { throw new AppError('LOCAL_SAVE_FAILED', 'falha'); }) } });

    const result = await service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile });

    expect(result.image.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.localSave.saved).toBe(false);
  });

  it('blocks concurrent generations and does not retry', async () => {
    let resolveProvider;
    const provider = { generate: vi.fn(() => new Promise((resolve) => { resolveProvider = resolve; })) };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn() } });
    const first = service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile });

    await vi.waitFor(() => expect(provider.generate).toHaveBeenCalledTimes(1));

    await expect(service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile })).rejects.toMatchObject({ code: 'GENERATION_IN_PROGRESS' });
    expect(provider.generate).toHaveBeenCalledTimes(1);
    resolveProvider({ body: { data: [{ b64_json: responseBase64, media_type: 'image/png' }], usage: {} }, requestId: null });
    await first;
  });

  it('propagates a provider response without an image and never retries', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [], usage: {} }, requestId: null })) };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn() } });

    await expect(service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile })).rejects.toMatchObject({ code: 'OPENROUTER_IMAGE_MISSING' });
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid Base64 from a simulated response', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: 'not-base64', media_type: 'image/png' }] }, requestId: null })) };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn() } });

    await expect(service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile })).rejects.toMatchObject({ code: 'OPENROUTER_INVALID_BASE64' });
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });
});
