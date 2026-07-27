// @vitest-environment node
import express from 'express';
import { createMarketingRouter } from '../../server/routes/marketing.js';
import { startTestServer } from './testServer.js';

describe('marketing HTTP API', () => {
  it('exposes the complete local planning and rendering contract with safe asset headers', async () => {
    const week = { id: 'week-1', weekStart: '2026-07-20', stories: [] };
    const service = {
      layouts: vi.fn(() => [{ id: 'minimal' }]), listSources: vi.fn(async () => [{ id: 'result-1' }]), listWeeks: vi.fn(async () => [week]),
      createWeek: vi.fn(async () => week), getWeek: vi.fn(async () => week), updateWeek: vi.fn(async () => week), approveWeek: vi.fn(async () => ({ ...week, status: 'approved' })), returnToDraft: vi.fn(async () => week), closeWeek: vi.fn(async () => ({ ...week, status: 'closed' })), proposeWeek: vi.fn(async () => week), deleteWeek: vi.fn(async () => ({ deleted: true })),
      addStory: vi.fn(async () => week), updateStory: vi.fn(async () => week), deleteStory: vi.fn(async () => week), renderStory: vi.fn(async () => week),
      setEditorialStatus: vi.fn(async () => week),
      readAsset: vi.fn(async (_weekId, _storyId, kind) => (kind === 'buffer'
        ? { buffer: Buffer.from('jpeg'), mimeType: 'image/jpeg', fileName: 'story-buffer.jpg' }
        : { buffer: Buffer.from('webp'), mimeType: 'image/webp', fileName: 'story.webp' })),
    };
    const storySuggestionsService = { suggest: vi.fn(async () => ({ suggestions: [{ calloutText: 'A', headline: 'B', subheadline: 'C', ctaText: 'D' }, { calloutText: 'E', headline: 'F', subheadline: 'G', ctaText: 'H' }, { calloutText: 'I', headline: 'J', subheadline: 'K', ctaText: 'L' }] })) };
    const app = express(); app.use(express.json()); app.use('/api/marketing', createMarketingRouter({ marketingService: service, storySuggestionsService }));
    const { baseUrl, close } = await startTestServer(app);
    try {
      expect((await fetch(`${baseUrl}/api/marketing/layouts`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/marketing/sources`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/marketing/suggestions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productLabel: 'Produto' }) })).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/marketing/weeks`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/marketing/weeks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekStart: '2026-07-20' }) })).status).toBe(201);
      expect((await fetch(`${baseUrl}/api/marketing/weeks/week-1/stories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(201);
      expect((await fetch(`${baseUrl}/api/marketing/weeks/week-1/stories/story-1/render`, { method: 'POST' })).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/marketing/weeks/week-1/proposal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [] }) })).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/marketing/weeks/week-1/stories/story-1/editorial-status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editorialStatus: 'published' }) })).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/marketing/weeks/week-1/close`, { method: 'POST' })).status).toBe(200);
      const asset = await fetch(`${baseUrl}/api/marketing/weeks/week-1/stories/story-1/assets/story`);
      expect(asset.headers.get('content-type')).toContain('image/webp');
      expect(asset.headers.get('content-length')).toBe('4');
      expect(asset.headers.get('x-content-type-options')).toBe('nosniff');
      const bufferAsset = await fetch(`${baseUrl}/api/marketing/weeks/week-1/stories/story-1/assets/buffer`);
      expect(bufferAsset.headers.get('content-type')).toContain('image/jpeg');
      expect(bufferAsset.headers.get('content-disposition')).toBe('attachment; filename="story-buffer.jpg"');
      expect(bufferAsset.headers.get('content-length')).toBe('4');
      expect(bufferAsset.headers.get('x-content-type-options')).toBe('nosniff');
      expect(service.renderStory).toHaveBeenCalledTimes(1);
      expect(storySuggestionsService.suggest).toHaveBeenCalledTimes(1);
    } finally { await close(); }
  });
});
