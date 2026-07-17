// @vitest-environment node
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createApp } from '../../server/app.js';
import { createLocalBrandingStorage } from '../../server/storage/localBrandingStorage.js';
import { createBrandingService } from '../../server/services/brandingService.js';
import { startTestServer } from './testServer.js';

const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function pngBuffer({ width = 512, height = 512 } = {}) {
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: Math.round(width * 0.6), height: Math.round(height * 0.6), channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer(), gravity: 'center' }])
    .png()
    .toBuffer();
}

async function fixtureApp() {
  const directory = await mkdtemp(path.join(tmpdir(), 'prime-branding-routes-'));
  directories.push(directory);
  const brandingStorage = createLocalBrandingStorage({ brandingDirectory: directory });
  const brandingService = createBrandingService({ storage: brandingStorage });
  const app = createApp({ brandingStorage, brandingService, generationService: { generate: vi.fn(), isBusy: () => false }, templateService: { list: vi.fn(async () => []), isBusy: () => false } });
  return { app, brandingService };
}

describe('branding HTTP API', () => {
  it('exposes an empty state before any upload', async () => {
    const { app } = await fixtureApp();
    const { baseUrl, close } = await startTestServer(app);
    try {
      const response = await fetch(`${baseUrl}/api/branding`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ config: { enabled: false }, pending: null, approved: null });
    } finally { await close(); }
  });

  it('uploads a logo via multipart, returns the validation report, and later serves it with safe headers', async () => {
    const { app } = await fixtureApp();
    const { baseUrl, close } = await startTestServer(app);
    try {
      const buffer = await pngBuffer();
      const form = new FormData();
      form.set('logo', new Blob([buffer], { type: 'image/png' }), 'logo.png');
      const uploadResponse = await fetch(`${baseUrl}/api/branding/logo`, { method: 'POST', body: form });
      expect(uploadResponse.status).toBe(201);
      const record = await uploadResponse.json();
      expect(record.quality).toBe('adequate');

      const pendingAsset = await fetch(`${baseUrl}/api/branding/logo?variant=pending`);
      expect(pendingAsset.status).toBe(200);
      expect(pendingAsset.headers.get('content-type')).toContain('image/png');
      expect(pendingAsset.headers.get('x-content-type-options')).toBe('nosniff');
      const receivedBuffer = Buffer.from(await pendingAsset.arrayBuffer());
      expect(receivedBuffer.equals(buffer)).toBe(true);
    } finally { await close(); }
  });

  it('approves a pending logo and exposes it as the approved variant', async () => {
    const { app } = await fixtureApp();
    const { baseUrl, close } = await startTestServer(app);
    try {
      const buffer = await pngBuffer();
      const form = new FormData();
      form.set('logo', new Blob([buffer], { type: 'image/png' }), 'logo.png');
      await fetch(`${baseUrl}/api/branding/logo`, { method: 'POST', body: form });
      const approveResponse = await fetch(`${baseUrl}/api/branding/approve`, { method: 'POST' });
      expect(approveResponse.status).toBe(200);
      const approved = await approveResponse.json();
      expect(approved.approvedAt).toBeTruthy();

      const approvedAsset = await fetch(`${baseUrl}/api/branding/logo`);
      expect(approvedAsset.status).toBe(200);
      const receivedBuffer = Buffer.from(await approvedAsset.arrayBuffer());
      expect(receivedBuffer.equals(buffer)).toBe(true);
    } finally { await close(); }
  });

  it('rejects enabling the toggle before approval, then accepts it after', async () => {
    const { app } = await fixtureApp();
    const { baseUrl, close } = await startTestServer(app);
    try {
      const before = await fetch(`${baseUrl}/api/branding/config`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
      expect(before.status).toBe(400);
      const errorBody = await before.json();
      expect(errorBody.error.code).toBe('BRANDING_NOT_APPROVED');

      const buffer = await pngBuffer();
      const form = new FormData();
      form.set('logo', new Blob([buffer], { type: 'image/png' }), 'logo.png');
      await fetch(`${baseUrl}/api/branding/logo`, { method: 'POST', body: form });
      await fetch(`${baseUrl}/api/branding/approve`, { method: 'POST' });

      const after = await fetch(`${baseUrl}/api/branding/config`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
      expect(after.status).toBe(200);
      expect((await after.json()).enabled).toBe(true);
    } finally { await close(); }
  });

  it('rejects an upload with an invalid signature with a safe 400 response', async () => {
    const { app } = await fixtureApp();
    const { baseUrl, close } = await startTestServer(app);
    try {
      const form = new FormData();
      form.set('logo', new Blob([Buffer.from('not a png')], { type: 'image/png' }), 'logo.png');
      const response = await fetch(`${baseUrl}/api/branding/logo`, { method: 'POST', body: form });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('BRANDING_LOGO_INVALID_SIGNATURE');
      expect(JSON.stringify(body)).not.toContain(process.cwd());
    } finally { await close(); }
  });

  it('serves the Original × Com logo preview, and 404s the branded variant before any logo is approved', async () => {
    const { app } = await fixtureApp();
    const { baseUrl, close } = await startTestServer(app);
    try {
      const originalResponse = await fetch(`${baseUrl}/api/branding/preview?variant=original`);
      expect(originalResponse.status).toBe(200);
      expect(originalResponse.headers.get('content-type')).toContain('image/jpeg');

      const brandedBefore = await fetch(`${baseUrl}/api/branding/preview?variant=branded`);
      expect(brandedBefore.status).toBe(404);
      expect((await brandedBefore.json()).error.code).toBe('BRANDING_NO_APPROVED_LOGO');

      const buffer = await pngBuffer();
      const form = new FormData();
      form.set('logo', new Blob([buffer], { type: 'image/png' }), 'logo.png');
      await fetch(`${baseUrl}/api/branding/logo`, { method: 'POST', body: form });
      await fetch(`${baseUrl}/api/branding/approve`, { method: 'POST' });

      const brandedAfter = await fetch(`${baseUrl}/api/branding/preview?variant=branded`);
      expect(brandedAfter.status).toBe(200);
      expect(brandedAfter.headers.get('content-type')).toContain('image/jpeg');
      const brandedBytes = Buffer.from(await brandedAfter.arrayBuffer());
      const originalBytes = Buffer.from(await (await fetch(`${baseUrl}/api/branding/preview?variant=original`)).arrayBuffer());
      expect(brandedBytes.equals(originalBytes)).toBe(false);
    } finally { await close(); }
  });

  it('deletes the approved logo', async () => {
    const { app } = await fixtureApp();
    const { baseUrl, close } = await startTestServer(app);
    try {
      const buffer = await pngBuffer();
      const form = new FormData();
      form.set('logo', new Blob([buffer], { type: 'image/png' }), 'logo.png');
      await fetch(`${baseUrl}/api/branding/logo`, { method: 'POST', body: form });
      await fetch(`${baseUrl}/api/branding/approve`, { method: 'POST' });
      const deleteResponse = await fetch(`${baseUrl}/api/branding/logo`, { method: 'DELETE' });
      expect(deleteResponse.status).toBe(200);
      expect(await deleteResponse.json()).toEqual({ deleted: true });
      const state = await (await fetch(`${baseUrl}/api/branding`)).json();
      expect(state.approved).toBeNull();
      expect(state.config.enabled).toBe(false);
    } finally { await close(); }
  });
});
