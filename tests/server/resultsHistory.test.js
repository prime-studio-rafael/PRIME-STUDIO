// @vitest-environment node
import path from 'node:path';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createLocalResultStorage } from '../../server/storage/localResultStorage.js';
import { createResultService } from '../../server/services/resultService.js';
import { validWebpBuffer } from './testServer.js';

const directories = [];
const image = validWebpBuffer();
function metadata(id, createdAt, extra = {}) { return { id, createdAt, status: 'success', modelId: 'nano-banana-lite', durationMs: 1200, costUsd: 0.034, ...extra }; }

afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'prime-results-')); directories.push(directory);
  const storage = createLocalResultStorage({ resultsDirectory: directory });
  await storage({ generationId: 'legacy-id', fileName: 'legacy.webp', imageBuffer: image, mimeType: 'image/webp', metadata: metadata('legacy-id', '2026-01-01T10:00:00.000Z', { templateId: 'model-01', providerModel: 'legacy-model', requestId: 'legacy-request', resultMime: 'image/webp', aspectRatio: '1:1' }) });
  await storage({ generationId: 'new-id', buffer: image, mimeType: 'image/webp', metadata: metadata('new-id', '2026-01-02T10:00:00.000Z', { inputTemplateId: 'model-02', inputTemplateLabel: 'Modelo 02', model: 'provider-model', promptVersion: 'upper-garment-v2', outputMime: 'image/webp' }), template: { buffer: image, mimeType: 'image/webp' }, garment: { buffer: image, mimeType: 'image/webp' } });
  return { directory, storage };
}

describe('local results history', () => {
  it('lists legacy and directory formats, normalizes fields and orders newest first', async () => {
    const { storage } = await fixture();
    const service = createResultService({ storage });
    const results = await service.list();
    expect(results.map((result) => result.id)).toEqual(['new-id', 'legacy-id']);
    expect(results[0]).toMatchObject({ reviewStatus: 'pending', templateId: 'model-02', templateLabel: 'Modelo 02', model: 'provider-model', promptVersion: 'upper-garment-v2' });
    expect(results[0].assets).toMatchObject({ result: expect.any(String), template: expect.any(String), garment: expect.any(String) });
    expect(results[1]).toMatchObject({ reviewStatus: 'pending', model: 'legacy-model', providerRequestId: 'legacy-request', outputMime: 'image/webp' });
    expect(results[1].assets).toMatchObject({ template: null, garment: null });
    expect(JSON.stringify(results)).not.toContain('/Users/');
  });

  it('ignores invalid JSON, orphan images and incomplete directories without breaking valid entries', async () => {
    const { directory, storage } = await fixture();
    await writeFile(path.join(directory, 'orphan.webp'), image);
    await writeFile(path.join(directory, 'invalid.webp'), image);
    await writeFile(path.join(directory, 'invalid.json'), '{');
    await mkdir(path.join(directory, 'incomplete'));
    await writeFile(path.join(directory, 'incomplete', 'metadata.json'), JSON.stringify({ id: 'incomplete' }));
    expect((await storage.listEntries()).map((entry) => entry.metadata.id).sort()).toEqual(['legacy-id', 'new-id']);
  });

  it('persists approval and rejection across a new storage instance', async () => {
    const { directory, storage } = await fixture();
    const service = createResultService({ storage });
    await service.setReviewStatus('legacy-id', 'approved');
    const restarted = createResultService({ storage: createLocalResultStorage({ resultsDirectory: directory }) });
    expect((await restarted.get('legacy-id')).reviewStatus).toBe('approved');
    await restarted.setReviewStatus('legacy-id', 'rejected');
    expect((await restarted.get('legacy-id')).reviewStatus).toBe('rejected');
    await expect(restarted.setReviewStatus('legacy-id', 'invalid')).rejects.toMatchObject({ code: 'INVALID_REVIEW_STATUS' });
  });

  it('serves all new assets with real MIME and rejects missing assets and traversal', async () => {
    const { storage } = await fixture();
    for (const type of ['result', 'template', 'garment']) expect(await storage.readAsset('new-id', type)).toMatchObject({ mimeType: 'image/webp', buffer: expect.any(Buffer) });
    await expect(storage.readAsset('legacy-id', 'garment')).rejects.toMatchObject({ code: 'RESULT_ASSET_NOT_FOUND', status: 404 });
    await expect(storage.findById('../metadata')).rejects.toMatchObject({ code: 'INVALID_RESULT_ID' });
    await expect(storage.readAsset('new-id', '../result')).rejects.toMatchObject({ code: 'INVALID_RESULT_ASSET' });
  });

  it('deletes legacy and directory results without affecting another generation', async () => {
    const { directory, storage } = await fixture();
    await storage.delete('legacy-id');
    expect((await storage.listEntries()).map((entry) => entry.metadata.id)).toEqual(['new-id']);
    await storage.delete('new-id');
    expect(await storage.listEntries()).toEqual([]);
    expect((await readdir(directory)).filter((name) => !name.startsWith('.'))).toEqual([]);
  });

  it('restores the legacy image when deletion cannot tombstone the metadata', async () => {
    const { directory } = await fixture();
    const guardedStorage = createLocalResultStorage({
      resultsDirectory: directory,
      fsImpl: {
        ...fsPromises,
        rename: vi.fn(async (source, target) => {
          if (String(source).endsWith('legacy.json')) throw new Error('simulated rename failure');
          return fsPromises.rename(source, target);
        }),
      },
    });
    await expect(guardedStorage.delete('legacy-id')).rejects.toMatchObject({ code: 'RESULT_DELETE_FAILED' });
    expect(await readFile(path.join(directory, 'legacy.webp'))).toEqual(image);
    expect(JSON.parse(await readFile(path.join(directory, 'legacy.json'), 'utf8'))).toMatchObject({ id: 'legacy-id' });
  });

  it('lists only approved assets with original bytes, and rejects when none are approved', async () => {
    const { storage } = await fixture();
    const service = createResultService({ storage });
    await expect(service.listApprovedAssets()).rejects.toMatchObject({ code: 'NO_APPROVED_RESULTS', status: 404 });
    await service.setReviewStatus('new-id', 'approved');
    const assets = await service.listApprovedAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ id: 'new-id', mimeType: 'image/webp' });
    expect(assets[0].buffer).toEqual(image);
    await service.setReviewStatus('legacy-id', 'rejected');
    expect(await service.listApprovedAssets()).toHaveLength(1);
  });

  it('stores result, template, garment and metadata without Base64', async () => {
    const { directory } = await fixture();
    const files = await readdir(path.join(directory, 'new-id'));
    expect(files.sort()).toEqual(['garment.webp', 'metadata.json', 'result.webp', 'template.webp']);
    const raw = await readFile(path.join(directory, 'new-id', 'metadata.json'), 'utf8');
    expect(raw).not.toMatch(/base64|data:image/i);
    expect(JSON.parse(raw)).toMatchObject({ reviewStatus: 'pending', localAssets: { result: 'result.webp', template: 'template.webp', garment: 'garment.webp' } });
  });

  it('normalizes legacy results without a branding metadata field as logoApplied: false with assets.branded null', async () => {
    const { storage } = await fixture();
    const service = createResultService({ storage });
    const legacy = await service.get('legacy-id');
    expect(legacy.logoApplied).toBe(false);
    expect(legacy.assets.branded).toBeNull();
    expect(legacy.brandingError).toBeNull();
  });

  it('persists and serves a branded variant alongside the original, never overwriting result', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'prime-results-branded-'));
    directories.push(directory);
    const storage = createLocalResultStorage({ resultsDirectory: directory });
    const brandedImage = validWebpBuffer();
    await storage({
      generationId: 'branded-id',
      buffer: image,
      mimeType: 'image/webp',
      metadata: metadata('branded-id', '2026-01-03T10:00:00.000Z', { logoApplied: true, brandedResultAsset: 'branded', originalResultAsset: 'result' }),
      template: { buffer: image, mimeType: 'image/webp' },
      garment: { buffer: image, mimeType: 'image/webp' },
      branded: { buffer: brandedImage, mimeType: 'image/webp' },
    });
    const service = createResultService({ storage });
    const result = await service.get('branded-id');
    expect(result.logoApplied).toBe(true);
    expect(result.assets.branded).toEqual(expect.any(String));
    const originalAsset = await storage.readAsset('branded-id', 'result');
    const brandedAsset = await storage.readAsset('branded-id', 'branded');
    expect(originalAsset.buffer).toEqual(image);
    expect(brandedAsset.buffer).toEqual(brandedImage);
  });

  it('selects the branded asset for the approved ZIP only when branding is enabled and the branded asset exists', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'prime-results-branded-zip-'));
    directories.push(directory);
    const storage = createLocalResultStorage({ resultsDirectory: directory });
    const brandedImage = validWebpBuffer();
    await storage({
      generationId: 'branded-zip-id',
      buffer: image,
      mimeType: 'image/webp',
      metadata: metadata('branded-zip-id', '2026-01-04T10:00:00.000Z', { logoApplied: true }),
      template: { buffer: image, mimeType: 'image/webp' },
      garment: { buffer: image, mimeType: 'image/webp' },
      branded: { buffer: brandedImage, mimeType: 'image/webp' },
    });

    const disabledBrandingService = { getState: async () => ({ config: { enabled: false } }) };
    const enabledBrandingService = { getState: async () => ({ config: { enabled: true } }) };

    const serviceDisabled = createResultService({ storage, brandingService: disabledBrandingService });
    await serviceDisabled.setReviewStatus('branded-zip-id', 'approved');
    const assetsWhenDisabled = await serviceDisabled.listApprovedAssets();
    expect(assetsWhenDisabled[0].buffer).toEqual(image);

    const serviceEnabled = createResultService({ storage, brandingService: enabledBrandingService });
    const assetsWhenEnabled = await serviceEnabled.listApprovedAssets();
    expect(assetsWhenEnabled[0].buffer).toEqual(brandedImage);
  });

  it('falls back to the original asset in the ZIP when branding is enabled but the result has no branded variant', async () => {
    const { storage } = await fixture();
    const enabledBrandingService = { getState: async () => ({ config: { enabled: true } }) };
    const service = createResultService({ storage, brandingService: enabledBrandingService });
    await service.setReviewStatus('new-id', 'approved');
    const assets = await service.listApprovedAssets();
    expect(assets[0].buffer).toEqual(image);
  });

  describe('Fase 5 — Template generation profile metadata', () => {
    it('normalizes a legacy result (no templateCategory/prompts/additionalInstruction/provider/origin) with null defaults and a derived individual origin, without rewriting the file on disk', async () => {
      const { storage, directory } = await fixture();
      const service = createResultService({ storage });
      const before = await readFile(path.join(directory, 'legacy.json'), 'utf8');
      const legacy = await service.get('legacy-id');
      expect(legacy).toMatchObject({
        templateCategory: null, inputTemplatePrompt: null, inputTemplateNegativePrompt: null,
        additionalInstruction: null, provider: null, batchId: null, batchItemId: null, origin: 'individual',
      });
      const after = await readFile(path.join(directory, 'legacy.json'), 'utf8');
      expect(after).toBe(before); // leitura nunca regrava o arquivo
    });

    it('derives origin "batch" from a persisted batchId, without needing an explicit origin field', async () => {
      const directory = await mkdtemp(path.join(tmpdir(), 'prime-results-batch-origin-'));
      directories.push(directory);
      const storage = createLocalResultStorage({ resultsDirectory: directory });
      await storage({
        generationId: 'batch-item-1', buffer: image, mimeType: 'image/webp',
        metadata: metadata('batch-item-1', '2026-01-05T10:00:00.000Z', { batchId: 'batch-1', batchItemId: 'item-1' }),
        template: { buffer: image, mimeType: 'image/webp' }, garment: { buffer: image, mimeType: 'image/webp' },
      });
      const service = createResultService({ storage });
      const result = await service.get('batch-item-1');
      expect(result.origin).toBe('batch');
      expect(result.batchId).toBe('batch-1');
      expect(result.batchItemId).toBe('item-1');
      expect(result.reviewStatus).toBe('pending'); // pending de lote aparece na fila igual ao individual
      const listed = await service.list();
      expect(listed.find((entry) => entry.id === 'batch-item-1')).toMatchObject({ reviewStatus: 'pending', origin: 'batch' });
      const approved = await service.setReviewStatus('batch-item-1', 'approved');
      expect(approved.reviewStatus).toBe('approved');
      const rejected = await service.setReviewStatus('batch-item-1', 'rejected');
      expect(rejected.reviewStatus).toBe('rejected');
    });

    it('respects an explicit metadata.origin when already valid, without recomputing it from batchId', async () => {
      const directory = await mkdtemp(path.join(tmpdir(), 'prime-results-explicit-origin-'));
      directories.push(directory);
      const storage = createLocalResultStorage({ resultsDirectory: directory });
      await storage({
        generationId: 'explicit-origin-1', buffer: image, mimeType: 'image/webp',
        metadata: metadata('explicit-origin-1', '2026-01-06T10:00:00.000Z', { origin: 'individual' }),
        template: { buffer: image, mimeType: 'image/webp' }, garment: { buffer: image, mimeType: 'image/webp' },
      });
      const service = createResultService({ storage });
      expect((await service.get('explicit-origin-1')).origin).toBe('individual');
    });

    it('exposes the new generation-profile fields when present in metadata', async () => {
      const directory = await mkdtemp(path.join(tmpdir(), 'prime-results-profile-'));
      directories.push(directory);
      const storage = createLocalResultStorage({ resultsDirectory: directory });
      await storage({
        generationId: 'profile-1', buffer: image, mimeType: 'image/webp',
        metadata: metadata('profile-1', '2026-01-07T10:00:00.000Z', {
          templateCategory: 'tenis-masculino',
          inputTemplatePrompt: 'Edite exclusivamente o calçado.',
          inputTemplateNegativePrompt: 'Não alterar o cadarço.',
          additionalInstruction: 'Aplicar acabamento fosco.',
          provider: 'openrouter',
        }),
        template: { buffer: image, mimeType: 'image/webp' }, garment: { buffer: image, mimeType: 'image/webp' },
      });
      const service = createResultService({ storage });
      const result = await service.get('profile-1');
      expect(result).toMatchObject({
        templateCategory: 'tenis-masculino',
        inputTemplatePrompt: 'Edite exclusivamente o calçado.',
        inputTemplateNegativePrompt: 'Não alterar o cadarço.',
        additionalInstruction: 'Aplicar acabamento fosco.',
        provider: 'openrouter',
        origin: 'individual',
      });
    });
  });
});
