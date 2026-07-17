import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { createLocalBatchRepository } from '../../server/repositories/localBatchRepository.js';
import { createBatchService } from '../../server/services/batchService.js';
import { createBatchQueue } from '../../server/services/batchQueue.js';
import { createGenerationCoordinator } from '../../server/services/generationCoordinator.js';

const source = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const directories = [];
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'prime-batch-')); directories.push(directory);
  const buffer = await readFile(source); const snapshot = { publicTemplate: { id: 'model-01', label: 'Modelo 01' }, image: { buffer, mimeType: 'image/jpeg', dimensions: { width: 773, height: 1024 } } };
  const repository = createLocalBatchRepository({ batchesDir: path.join(directory, 'batches') });
  const service = createBatchService({ repository, templateService: { getForGeneration: vi.fn(async () => snapshot) }, uuid: (() => { let i = 0; return () => `00000000-0000-4000-8000-00000000000${++i}`; })() });
  return { directory, buffer, repository, service };
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
});
