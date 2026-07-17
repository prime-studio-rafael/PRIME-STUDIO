// @vitest-environment node
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import yauzl from 'yauzl';
import { createApp } from '../../server/app.js';
import { createLocalResultStorage } from '../../server/storage/localResultStorage.js';
import { createResultService } from '../../server/services/resultService.js';
import { startTestServer, validWebpBuffer } from './testServer.js';

const directories = [];
const image = validWebpBuffer();
function metadata(id, createdAt, extra = {}) { return { id, createdAt, status: 'success', modelId: 'nano-banana-lite', durationMs: 1200, costUsd: 0.034, ...extra }; }

afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'prime-results-zip-'));
  directories.push(directory);
  const storage = createLocalResultStorage({ resultsDirectory: directory });
  const templateAndGarment = { template: { buffer: image, mimeType: 'image/webp' }, garment: { buffer: image, mimeType: 'image/webp' } };
  await storage({ generationId: 'approved-1', buffer: image, mimeType: 'image/webp', metadata: metadata('approved-1', '2026-01-03T10:00:00.000Z', { outputMime: 'image/webp' }), ...templateAndGarment });
  await storage({ generationId: 'approved-2', buffer: image, mimeType: 'image/webp', metadata: metadata('approved-2', '2026-01-02T10:00:00.000Z', { outputMime: 'image/webp' }), ...templateAndGarment });
  await storage({ generationId: 'pending-1', buffer: image, mimeType: 'image/webp', metadata: metadata('pending-1', '2026-01-01T10:00:00.000Z', { outputMime: 'image/webp' }), ...templateAndGarment });
  const service = createResultService({ storage });
  await service.setReviewStatus('approved-1', 'approved');
  await service.setReviewStatus('approved-2', 'approved');
  await service.setReviewStatus('pending-1', 'rejected');
  return { storage, service };
}

async function readZipEntries(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipfile) => {
      if (error) return reject(error);
      const entries = [];
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        zipfile.openReadStream(entry, (streamError, readStream) => {
          if (streamError) return reject(streamError);
          const chunks = [];
          readStream.on('data', (chunk) => chunks.push(chunk));
          readStream.on('end', () => { entries.push({ name: entry.fileName, buffer: Buffer.concat(chunks) }); zipfile.readEntry(); });
        });
      });
      zipfile.on('end', () => resolve(entries));
      zipfile.on('error', reject);
    });
  });
}

describe('GET /api/results/download/approved', () => {
  it('zips only approved results with original bytes, correct MIME and filename', async () => {
    const { service } = await fixture();
    const app = createApp({ resultService: service, generationService: { generate: vi.fn(), isBusy: () => false }, templateService: { list: vi.fn(async () => []), isBusy: () => false } });
    const { baseUrl, close } = await startTestServer(app);
    try {
      const response = await fetch(`${baseUrl}/api/results/download/approved`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/zip');
      expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="prime-studio-aprovadas-\d{4}-\d{2}-\d{2}\.zip"$/);
      const buffer = Buffer.from(await response.arrayBuffer());
      const rawText = buffer.toString('latin1');
      expect(rawText).not.toMatch(/base64/i);
      expect(rawText).not.toContain(process.cwd());
      const entries = await readZipEntries(buffer);
      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.name).sort()).toEqual(['prime-studio-approved-1.webp', 'prime-studio-approved-2.webp']);
      for (const entry of entries) expect(entry.buffer).toEqual(image);
    } finally { await close(); }
  });

  it('returns 404 without generating a zip when there are no approved results', async () => {
    const { storage } = await fixture();
    const service = createResultService({ storage });
    await service.setReviewStatus('approved-1', 'pending');
    await service.setReviewStatus('approved-2', 'rejected');
    const app = createApp({ resultService: service, generationService: { generate: vi.fn(), isBusy: () => false }, templateService: { list: vi.fn(async () => []), isBusy: () => false } });
    const { baseUrl, close } = await startTestServer(app);
    try {
      const response = await fetch(`${baseUrl}/api/results/download/approved`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NO_APPROVED_RESULTS');
    } finally { await close(); }
  });

  it('is not shadowed by the /:id route', async () => {
    const service = { list: vi.fn(async () => []), get: vi.fn(), readAsset: vi.fn(), setReviewStatus: vi.fn(), delete: vi.fn(), listApprovedAssets: vi.fn(async () => [{ id: 'x', buffer: image, mimeType: 'image/webp', filename: 'prime-studio-x.webp' }]) };
    const app = createApp({ resultService: service, generationService: { generate: vi.fn(), isBusy: () => false }, templateService: { list: vi.fn(async () => []), isBusy: () => false } });
    const { baseUrl, close } = await startTestServer(app);
    try {
      const response = await fetch(`${baseUrl}/api/results/download/approved`);
      expect(response.status).toBe(200);
      expect(service.get).not.toHaveBeenCalled();
      expect(service.listApprovedAssets).toHaveBeenCalled();
    } finally { await close(); }
  });

  it('gives duplicate filenames unique names inside the zip', async () => {
    const service = { list: vi.fn(async () => []), get: vi.fn(), readAsset: vi.fn(), setReviewStatus: vi.fn(), delete: vi.fn(), listApprovedAssets: vi.fn(async () => [
      { id: 'a', buffer: Buffer.from('AAAA'), mimeType: 'image/webp', filename: 'result.webp' },
      { id: 'b', buffer: Buffer.from('BBBB'), mimeType: 'image/webp', filename: 'result.webp' },
    ]) };
    const app = createApp({ resultService: service, generationService: { generate: vi.fn(), isBusy: () => false }, templateService: { list: vi.fn(async () => []), isBusy: () => false } });
    const { baseUrl, close } = await startTestServer(app);
    try {
      const response = await fetch(`${baseUrl}/api/results/download/approved`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const entries = await readZipEntries(buffer);
      expect(entries.map((entry) => entry.name).sort()).toEqual(['result-2.webp', 'result.webp']);
    } finally { await close(); }
  });

  it('rejects a crafted filename attempting path traversal by sanitizing to a basename', async () => {
    const service = { list: vi.fn(async () => []), get: vi.fn(), readAsset: vi.fn(), setReviewStatus: vi.fn(), delete: vi.fn(), listApprovedAssets: vi.fn(async () => [{ id: 'evil', buffer: Buffer.from('EVIL'), mimeType: 'image/webp', filename: '../../etc/passwd.webp' }]) };
    const app = createApp({ resultService: service, generationService: { generate: vi.fn(), isBusy: () => false }, templateService: { list: vi.fn(async () => []), isBusy: () => false } });
    const { baseUrl, close } = await startTestServer(app);
    try {
      const response = await fetch(`${baseUrl}/api/results/download/approved`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const entries = await readZipEntries(buffer);
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('passwd.webp');
      expect(entries[0].name).not.toContain('..');
      expect(entries[0].name).not.toContain('/');
    } finally { await close(); }
  });
});
