// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGenerationService } from '../../server/services/generateImage.js';
import { createGenerationExecutor } from '../../server/services/generationExecutor.js';
import { createBatchService } from '../../server/services/batchService.js';
import { createBatchQueue } from '../../server/services/batchQueue.js';
import { createGenerationCoordinator } from '../../server/services/generationCoordinator.js';
import { createLocalBatchRepository } from '../../server/repositories/localBatchRepository.js';
import { createLocalResultStorage } from '../../server/storage/localResultStorage.js';

const templateSource = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const responseBase64 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64').toString('base64');

const PROFILE = {
  id: 'model-01', label: 'Modelo 01', category: 'moda-masculina',
  prompt: 'Edite exclusivamente o item-alvo desta categoria de teste.',
  negativePrompt: 'Não incluir estampas extras.',
  provider: 'openrouter', modelId: 'nano-banana-lite',
  generationAspectRatio: '1:1', resolution: '1K', promptVersion: 'template-parity01',
};
const ADDITIONAL_INSTRUCTION = 'Aplicar acabamento fosco nesta geração.';

const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

function providerMock() {
  return { generate: vi.fn(async () => ({ body: { data: [{ b64_json: responseBase64, media_type: 'image/png' }], usage: { cost: 0.034 } }, requestId: 'parity-request' })) };
}

describe('generation parity — individual vs batch', () => {
  it('sends the same final prompt, model, resolution, aspectRatio and input references for the same Template profile and additionalInstruction', async () => {
    const templateBuffer = await readFile(templateSource);
    const garmentFile = { buffer: templateBuffer, mimetype: 'image/jpeg', size: templateBuffer.length, originalname: 'garment.jpeg' };

    // Geração individual
    const individualProvider = providerMock();
    const individualService = createGenerationService({
      openRouterClient: individualProvider,
      resultStorage: { save: vi.fn() },
      templateService: { getForGeneration: vi.fn(async () => ({ publicTemplate: PROFILE, image: { buffer: templateBuffer, mimeType: 'image/jpeg', dimensions: { width: 773, height: 1024 } } })) },
    });
    await individualService.generate({ templateId: 'model-01', modelId: 'nano-banana-lite', confirmPaid: true, garmentFile, additionalInstruction: ADDITIONAL_INSTRUCTION });

    // Lote — mesmo perfil e mesma additionalInstruction, congelados na criação
    const directory = await mkdtemp(path.join(tmpdir(), 'prime-parity-batch-')); directories.push(directory);
    const repository = createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') });
    const batchService = createBatchService({ repository, templateService: { getForGeneration: vi.fn(async () => ({ publicTemplate: PROFILE, image: { buffer: templateBuffer, mimeType: 'image/jpeg', dimensions: { width: 773, height: 1024 } } })) } });
    const batchProvider = providerMock();
    const executor = createGenerationExecutor({ openRouterClient: batchProvider, resultStorage: createLocalResultStorage({ resultsDir: path.join(directory, 'results') }) });
    const coordinator = createGenerationCoordinator();
    createBatchQueue({ batchService, executor, coordinator });
    const batch = await batchService.create({ name: 'Paridade', templateId: 'model-01', files: [{ buffer: templateBuffer, mimetype: 'image/jpeg', originalname: 'garment.jpeg' }], additionalInstruction: ADDITIONAL_INSTRUCTION });
    await batchService.start(batch.id, { confirmPaid: true });
    await vi.waitFor(async () => expect((await batchService.get(batch.id)).status).toBe('completed'));

    expect(individualProvider.generate).toHaveBeenCalledTimes(1);
    expect(batchProvider.generate).toHaveBeenCalledTimes(1);
    const individualCall = individualProvider.generate.mock.calls[0][0];
    const batchCall = batchProvider.generate.mock.calls[0][0];
    expect(batchCall.prompt).toBe(individualCall.prompt);
    expect(batchCall.model).toBe(individualCall.model);
    expect(batchCall.resolution).toBe(individualCall.resolution);
    expect(batchCall.aspectRatio).toBe(individualCall.aspectRatio);
    expect(batchCall.inputReferences).toEqual(individualCall.inputReferences);
    expect(individualCall.prompt).toContain('--- INSTRUÇÃO ADICIONAL DESTA GERAÇÃO ---\nAplicar acabamento fosco nesta geração.');
  });

  it('honors modelId frozen in the batch snapshot instead of any hardcoded value in batchQueue', async () => {
    const templateBuffer = await readFile(templateSource);
    const directory = await mkdtemp(path.join(tmpdir(), 'prime-parity-modelid-')); directories.push(directory);
    const repository = createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') });
    const batchService = createBatchService({ repository, templateService: { getForGeneration: vi.fn(async () => ({ publicTemplate: PROFILE, image: { buffer: templateBuffer, mimeType: 'image/jpeg', dimensions: { width: 773, height: 1024 } } })) } });
    const executeSpy = vi.fn(async () => ({ generationId: 'g1', metrics: { costUsd: 0.034, durationMs: 5 }, requestId: 'r1' }));
    const coordinator = createGenerationCoordinator();
    createBatchQueue({ batchService, executor: { execute: executeSpy }, coordinator });
    const batch = await batchService.create({ name: 'ModelId', templateId: 'model-01', files: [{ buffer: templateBuffer, mimetype: 'image/jpeg', originalname: 'garment.jpeg' }] });
    await batchService.start(batch.id, { confirmPaid: true });
    await vi.waitFor(async () => expect((await batchService.get(batch.id)).status).toBe('completed'));

    expect(executeSpy).toHaveBeenCalledTimes(1);
    const callArgs = executeSpy.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('modelId'); // batchQueue.js não injeta mais nenhum modelId
    expect(callArgs.templateSnapshot.modelId).toBe('nano-banana-lite'); // só o congelado no snapshot
  });
});
