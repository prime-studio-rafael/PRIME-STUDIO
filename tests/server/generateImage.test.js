import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createGenerationService } from '../../server/services/generateImage.js';
import { createLocalResultStorage } from '../../server/storage/localResultStorage.js';
import { createLocalBrandingStorage } from '../../server/storage/localBrandingStorage.js';
import { createBrandingService } from '../../server/services/brandingService.js';
import { AppError } from '../../server/utils/errors.js';
import { validateImageBuffer } from '../../server/utils/fileValidation.js';
import { generationConfig } from '../../server/config/generationConfig.js';
import { createLocalTemplateRepository } from '../../server/repositories/localTemplateRepository.js';
import { createTemplateService } from '../../server/services/templateService.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const responseBase64 = png.toString('base64');
const templateSource = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const TEMPLATE_PROMPT = 'Edite exclusivamente a roupa da parte superior do corpo da pessoa da Imagem 1, usando a roupa da Imagem 2 como referência visual.';

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
    templateService: {
      getForGeneration: vi.fn(async () => {
        const buffer = await readFile(templatePath);
        const image = validateImageBuffer(buffer, {
          maxBytes: generationConfig.maxFileSizeBytes,
          fieldLabel: 'Modelo base 01',
          fileName: 'model-01.jpeg',
          expectedMimeType: 'image/jpeg',
          role: 'template',
          policy: generationConfig.imagePolicy,
        });
        return { publicTemplate: { id: 'model-01', label: 'Modelo base 01', valid: true, active: true, prompt: TEMPLATE_PROMPT, promptVersion: 'upper-garment-v2', negativePrompt: null, provider: null, modelId: null, generationAspectRatio: null, resolution: null }, image };
      }),
    },
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
    const savedDirectory = path.join(resultsDir, result.generationId);
    expect((await readdir(savedDirectory)).sort()).toEqual(['garment.jpg', 'metadata.json', 'result.png', 'template.jpg']);
    expect(await readFile(path.join(savedDirectory, 'template.jpg'))).toEqual(garmentFile.buffer);
    expect(await readFile(path.join(savedDirectory, 'garment.jpg'))).toEqual(garmentFile.buffer);
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
      reviewStatus: 'pending',
    });
    expect(metadata.configurationId).toMatch(/^[a-f0-9]{12}$/);
    expect(metadata).not.toHaveProperty('garmentFile');
    expect(JSON.stringify(metadata)).not.toContain('base64');
  });

  it('uses a newly created local template and preserves its id, bytes and metadata contract', async () => {
    const repository = createLocalTemplateRepository({ templatesDirectory: path.join(fixture.directory, 'templates') });
    const templateService = createTemplateService({ repository });
    const created = await templateService.create({
      label: 'Template criado no teste',
      description: 'Integração simulada',
      file: garmentFile,
      prompt: 'Edite exclusivamente o item-alvo desta categoria de teste.',
    });
    const provider = {
      generate: vi.fn(async () => ({
        body: { data: [{ b64_json: responseBase64, media_type: 'image/png' }], usage: { cost: 0.034 } },
        requestId: 'created-template-request',
      })),
    };
    const storage = { save: vi.fn(async () => ({ saved: true, metadataSaved: true, imageFilename: 'mock.png', metadataFilename: 'mock.json' })) };
    const service = createGenerationService({ openRouterClient: provider, resultStorage: storage, templateService });

    await service.generate({ templateId: created.id, modelId: generationConfig.modelId, confirmPaid: true, garmentFile });

    const resolved = await templateService.getForGeneration(created.id);
    expect(resolved.publicTemplate).toMatchObject({ id: created.id, active: true, valid: true, mimeType: 'image/jpeg', width: 773, height: 1024 });
    expect(resolved.image.buffer.equals(garmentFile.buffer)).toBe(true);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(provider.generate.mock.calls[0][0]).toMatchObject({
      model: 'google/gemini-3.1-flash-lite-image',
      resolution: '1K',
      aspectRatio: '1:1',
      inputReferences: [expect.stringMatching(/^data:image\/jpeg;base64,/), expect.stringMatching(/^data:image\/jpeg;base64,/)],
    });
    expect(storage.save.mock.calls[0][0].metadata).toMatchObject({
      promptVersion: expect.stringMatching(/^template-[0-9a-f]{8}$/),
      model: 'google/gemini-3.1-flash-lite-image',
      resolution: '1K',
      effectiveAspectRatio: '1:1',
      inputTemplateId: created.id,
      inputTemplateMime: 'image/jpeg',
      inputTemplateDimensions: { width: 773, height: 1024 },
    });
  });

  it('requires paid confirmation', async () => {
    const provider = { generate: vi.fn() };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn() } });

    await expect(service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: false, garmentFile })).rejects.toMatchObject({ code: 'PAID_CONFIRMATION_REQUIRED' });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('does not start while a template mutation is active', async () => {
    const provider = { generate: vi.fn() };
    const service = createGenerationService({
      openRouterClient: provider,
      resultStorage: { save: vi.fn() },
      templateService: { isBusy: () => true, getForGeneration: vi.fn() },
    });

    await expect(service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile })).rejects.toMatchObject({ code: 'TEMPLATE_MUTATION_IN_PROGRESS', status: 409 });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('rejects an invalid template without calling the provider', async () => {
    const provider = { generate: vi.fn() };
    const service = createGenerationService({
      openRouterClient: provider,
      resultStorage: { save: vi.fn() },
      templateService: {
        getForGeneration: vi.fn(async () => {
          throw new AppError('INVALID_TEMPLATE', 'O template selecionado não existe.', { status: 400 });
        }),
      },
    });

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

  it('blocks generation before the lock/provider call when the Template has no prompt configured, without consuming credit', async () => {
    const provider = { generate: vi.fn() };
    const service = createGenerationService({
      openRouterClient: provider,
      resultStorage: { save: vi.fn() },
      templateService: {
        getForGeneration: vi.fn(async () => ({ publicTemplate: { id: 'tenis-9060', label: 'Tenis 9060', valid: true, active: true, prompt: null, promptVersion: null } })),
      },
    });

    await expect(service.generate({ templateId: 'tenis-9060', modelId: generationConfig.modelId, confirmPaid: true, garmentFile }))
      .rejects.toMatchObject({ code: 'TEMPLATE_PROFILE_INCOMPLETE', status: 422 });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('rejects a Template configured for an unsupported provider, without calling the client', async () => {
    const provider = { generate: vi.fn() };
    const withUnsupportedProvider = createGenerationService({
      openRouterClient: provider,
      resultStorage: { save: vi.fn() },
      templateService: {
        getForGeneration: vi.fn(async () => {
          const buffer = await readFile(fixture.templatePath);
          const image = validateImageBuffer(buffer, { maxBytes: generationConfig.maxFileSizeBytes, fieldLabel: 'Modelo base 01', fileName: 'model-01.jpeg', expectedMimeType: 'image/jpeg', role: 'template', policy: generationConfig.imagePolicy });
          return { publicTemplate: { id: 'model-01', label: 'Modelo base 01', valid: true, active: true, prompt: TEMPLATE_PROMPT, promptVersion: 'upper-garment-v2', provider: 'another-provider' }, image };
        }),
      },
    });

    await expect(withUnsupportedProvider.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('appends additionalInstruction as the last section of the final prompt, without altering the Template', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: responseBase64, media_type: 'image/png' }], usage: { cost: 0.034 } }, requestId: 'mock-request' })) };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn() } });

    await service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile, additionalInstruction: 'Instrução exclusiva desta geração de teste.' });

    const sentPrompt = provider.generate.mock.calls[0][0].prompt;
    expect(sentPrompt).toContain('--- INSTRUÇÃO ADICIONAL DESTA GERAÇÃO ---\nInstrução exclusiva desta geração de teste.');
    expect(sentPrompt.indexOf('INSTRUÇÃO ADICIONAL')).toBeGreaterThan(sentPrompt.indexOf('PROIBIÇÕES FINAIS'));
  });

  it('accepts an additionalInstruction with exactly 500 characters and rejects 501, without calling the provider', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: responseBase64, media_type: 'image/png' }], usage: { cost: 0.034 } }, requestId: 'mock-request' })) };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn() } });

    await expect(service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile, additionalInstruction: 'x'.repeat(501) }))
      .rejects.toMatchObject({ code: 'ADDITIONAL_INSTRUCTION_TOO_LONG', status: 422 });
    expect(provider.generate).not.toHaveBeenCalled();

    await service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile, additionalInstruction: 'x'.repeat(500) });
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });

  it('never repeats globalRules and omits empty sections when there is no negativePrompt/additionalInstruction', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: responseBase64, media_type: 'image/png' }], usage: { cost: 0.034 } }, requestId: 'mock-request' })) };
    const service = createService({ templatePath: fixture.templatePath, openRouterClient: provider, resultStorage: { save: vi.fn() } });

    await service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile });

    const sentPrompt = provider.generate.mock.calls[0][0].prompt;
    for (const section of ['PAPEL DAS IMAGENS', 'ELEMENTOS IMUTÁVEIS', 'REGIÃO EDITÁVEL', 'FIDELIDADE DO ITEM', 'MARCAS, LOGOS E TEXTOS', 'OCLUSÕES E INTEGRAÇÃO FÍSICA', 'REGRA DE INCERTEZA', 'PROIBIÇÕES FINAIS']) {
      expect(sentPrompt.split(section)).toHaveLength(2); // aparece exatamente uma vez
    }
    expect(sentPrompt).not.toContain('PROMPT NEGATIVO');
    expect(sentPrompt).not.toContain('INSTRUÇÃO ADICIONAL');
  });
});

describe('generation service — Branding integration', () => {
  let fixture;
  let generatedImageBase64;

  beforeEach(async () => {
    fixture = await createFixture();
    const buffer = await readFile(templateSource);
    garmentFile = { buffer, mimetype: 'image/jpeg', size: buffer.length, originalname: 'garment.jpeg' };
    const generatedImage = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 20, g: 40, b: 60 } } }).jpeg().toBuffer();
    generatedImageBase64 = generatedImage.toString('base64');
  });

  afterEach(async () => {
    await rm(fixture.directory, { recursive: true, force: true });
  });

  async function logoPngBuffer() {
    return sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp({ create: { width: 240, height: 240, channels: 4, background: { r: 220, g: 20, b: 20, alpha: 1 } } }).png().toBuffer(), gravity: 'center' }])
      .png()
      .toBuffer();
  }

  async function brandingFixture({ enabled }) {
    const brandingDirectory = path.join(fixture.directory, 'branding');
    const brandingStorage = createLocalBrandingStorage({ brandingDirectory });
    const brandingService = createBrandingService({ storage: brandingStorage });
    if (enabled) {
      await brandingService.uploadLogo({ buffer: await logoPngBuffer(), mimetype: 'image/png', originalname: 'logo.png' });
      await brandingService.approveLogo();
      await brandingService.setConfig({ enabled: true });
    }
    return brandingService;
  }

  it('keeps the existing behaviour unchanged when Branding is disabled, without calling sharp for overlay', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: generatedImageBase64, media_type: 'image/jpeg' }], usage: { cost: 0.034 } }, requestId: 'req-1' })) };
    const resultsDir = path.join(fixture.directory, 'results');
    const storage = createLocalResultStorage({ resultsDir });
    const brandingService = await brandingFixture({ enabled: false });
    const service = createGenerationService({
      openRouterClient: provider,
      resultStorage: storage,
      brandingService,
      templateService: {
        getForGeneration: vi.fn(async () => {
          const buffer = await readFile(fixture.templatePath);
          const image = validateImageBuffer(buffer, { maxBytes: generationConfig.maxFileSizeBytes, fieldLabel: 'Modelo base 01', fileName: 'model-01.jpeg', expectedMimeType: 'image/jpeg', role: 'template', policy: generationConfig.imagePolicy });
          return { publicTemplate: { id: 'model-01', label: 'Modelo base 01', valid: true, active: true, prompt: TEMPLATE_PROMPT, promptVersion: 'upper-garment-v2', negativePrompt: null, provider: null, modelId: null, generationAspectRatio: null, resolution: null }, image };
        }),
      },
    });

    const result = await service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile });
    expect(result.metadata.logoApplied).toBe(false);
    expect(result.metadata.brandingStatus).toBe('disabled');
    const savedDirectory = path.join(resultsDir, result.generationId);
    expect((await readdir(savedDirectory)).sort()).toEqual(['garment.jpg', 'metadata.json', 'result.jpg', 'template.jpg']);
  });

  it('applies the logo overlay and saves both variants when Branding is enabled and approved', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: generatedImageBase64, media_type: 'image/jpeg' }], usage: { cost: 0.034 } }, requestId: 'req-2' })) };
    const resultsDir = path.join(fixture.directory, 'results');
    const storage = createLocalResultStorage({ resultsDir });
    const brandingService = await brandingFixture({ enabled: true });
    const service = createGenerationService({
      openRouterClient: provider,
      resultStorage: storage,
      brandingService,
      templateService: {
        getForGeneration: vi.fn(async () => {
          const buffer = await readFile(fixture.templatePath);
          const image = validateImageBuffer(buffer, { maxBytes: generationConfig.maxFileSizeBytes, fieldLabel: 'Modelo base 01', fileName: 'model-01.jpeg', expectedMimeType: 'image/jpeg', role: 'template', policy: generationConfig.imagePolicy });
          return { publicTemplate: { id: 'model-01', label: 'Modelo base 01', valid: true, active: true, prompt: TEMPLATE_PROMPT, promptVersion: 'upper-garment-v2', negativePrompt: null, provider: null, modelId: null, generationAspectRatio: null, resolution: null }, image };
        }),
      },
    });

    const result = await service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile });

    expect(provider.generate).toHaveBeenCalledTimes(1); // uma chamada, independentemente do branding
    expect(result.metadata.logoApplied).toBe(true);
    expect(result.metadata.brandingStatus).toBe('applied');
    expect(result.metadata.logoPosition).toBe('bottom-right');
    expect(result.metadata.originalResultAsset).toBe('result');
    expect(result.metadata.brandedResultAsset).toBe('branded');

    const savedDirectory = path.join(resultsDir, result.generationId);
    const files = await readdir(savedDirectory);
    expect(files.sort()).toEqual(['branded.jpg', 'garment.jpg', 'metadata.json', 'result.jpg', 'template.jpg']);
    const originalBuffer = await readFile(path.join(savedDirectory, 'result.jpg'));
    const brandedBuffer = await readFile(path.join(savedDirectory, 'branded.jpg'));
    expect(originalBuffer.equals(brandedBuffer)).toBe(false); // a versão branded difere da original
    expect(originalBuffer.length).toBeGreaterThan(0);
  });

  it('preserves the original result and records a safe branding error when the overlay fails, without retrying or losing the paid generation', async () => {
    const provider = { generate: vi.fn(async () => ({ body: { data: [{ b64_json: generatedImageBase64, media_type: 'image/jpeg' }], usage: { cost: 0.034 } }, requestId: 'req-3' })) };
    const resultsDir = path.join(fixture.directory, 'results');
    const storage = createLocalResultStorage({ resultsDir });
    const approvedBrandingService = await brandingFixture({ enabled: true });
    // Simula uma logo aprovada cujo arquivo em disco foi corrompido depois da aprovação.
    const brandingService = { ...approvedBrandingService, getActiveBranding: async () => ({ buffer: Buffer.from('corrupted-not-a-real-png'), mimeType: 'image/png', fileName: 'logo.png' }) };

    const service = createGenerationService({
      openRouterClient: provider,
      resultStorage: storage,
      brandingService,
      templateService: {
        getForGeneration: vi.fn(async () => {
          const buffer = await readFile(fixture.templatePath);
          const image = validateImageBuffer(buffer, { maxBytes: generationConfig.maxFileSizeBytes, fieldLabel: 'Modelo base 01', fileName: 'model-01.jpeg', expectedMimeType: 'image/jpeg', role: 'template', policy: generationConfig.imagePolicy });
          return { publicTemplate: { id: 'model-01', label: 'Modelo base 01', valid: true, active: true, prompt: TEMPLATE_PROMPT, promptVersion: 'upper-garment-v2', negativePrompt: null, provider: null, modelId: null, generationAspectRatio: null, resolution: null }, image };
        }),
      },
    });

    const result = await service.generate({ templateId: 'model-01', modelId: generationConfig.modelId, confirmPaid: true, garmentFile });

    expect(provider.generate).toHaveBeenCalledTimes(1); // zero retry mesmo com falha no branding
    expect(result.localSave.saved).toBe(true); // a geração paga não é perdida
    expect(result.metadata.logoApplied).toBe(false);
    expect(result.metadata.brandingStatus).toBe('failed');
    expect(result.metadata.brandingError).toMatchObject({ code: expect.any(String), message: expect.any(String) });
    const savedDirectory = path.join(resultsDir, result.generationId);
    expect((await readdir(savedDirectory)).sort()).toEqual(['garment.jpg', 'metadata.json', 'result.jpg', 'template.jpg']); // sem branded.*
  });
});
