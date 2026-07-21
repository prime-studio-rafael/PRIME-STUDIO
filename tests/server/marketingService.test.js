import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createLocalMarketingRepository } from '../../server/repositories/localMarketingRepository.js';
import { createMarketingService } from '../../server/services/marketingService.js';

let directory;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = null; });

async function fixture({ approved = true } = {}) {
  directory = await mkdtemp(path.join(tmpdir(), 'prime-marketing-service-'));
  const repository = createLocalMarketingRepository({ marketingDir: directory });
  let index = 0;
  const results = [
    { id: 'result-1', reviewStatus: approved ? 'approved' : 'pending', createdAt: '2026-07-20T10:00:00Z', templateLabel: 'Camisa', templateCategory: 'moda-masculina', assets: { result: '/result', branded: '/branded' } },
    { id: 'result-2', reviewStatus: approved ? 'approved' : 'pending', createdAt: '2026-07-20T11:00:00Z', templateLabel: 'Bolsa', templateCategory: 'bolsas', assets: { result: '/result' } },
    { id: 'result-3', reviewStatus: approved ? 'approved' : 'pending', createdAt: '2026-07-20T12:00:00Z', templateLabel: 'Tênis', templateCategory: 'tenis-masculino', assets: { result: '/result' } },
  ];
  const resultService = {
    list: vi.fn(async () => results),
    get: vi.fn(async (id) => results.find((result) => result.id === id)),
    readAsset: vi.fn(async (_id, type) => ({ buffer: Buffer.from(`bytes-${type}`), mimeType: 'image/jpeg', filename: `${type}.jpg` })),
  };
  const brandingService = { readLogoAsset: vi.fn(async () => ({ buffer: Buffer.from('logo'), mimeType: 'image/png' })) };
  const renderer = vi.fn(async () => ({ buffer: Buffer.from('rendered'), mimeType: 'image/webp', dimensions: { width: 1080, height: 1920 } }));
  const service = createMarketingService({ repository, resultService, brandingService, renderStory: renderer, uuid: () => { const value = index++; return value === 0 ? 'week-1' : `story-${value}`; }, now: () => new Date('2026-07-20T12:00:00.000Z') });
  return { service, repository, resultService, renderer };
}

const story = { sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Camisa Ágil 01', priceText: 'R$ 99', headline: '10% no PIX', ctaText: 'Comprar', storyTemplateId: 'product-highlight', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1 };

describe('marketingService', () => {
  it('creates a Monday week and copies only an approved result into a normalized Story', async () => {
    const { service, repository, resultService } = await fixture();
    await service.createWeek({ weekStart: '2026-07-20' });
    const week = await service.addStory('week-1', story);
    expect(week.stories[0]).toMatchObject({ id: 'story-1', productKey: 'camisa-agil-01', category: 'moda-masculina', categoryLabel: 'Moda Masculina', sourceAssetFileName: 'story-1.jpg', renderStatus: 'pending', editorialStatus: 'planned' });
    expect(resultService.readAsset).toHaveBeenCalledWith('result-1', 'result');
    expect(await repository.readAsset('week-1', 'sources', 'story-1.jpg')).toEqual(Buffer.from('bytes-result'));
    expect(JSON.stringify(week)).not.toMatch(/base64|\/Users\//i);
  });

  it('blocks non-approved sources, invalid weeks and dates outside the selected week', async () => {
    const pending = await fixture({ approved: false });
    await pending.service.createWeek({ weekStart: '2026-07-20' });
    await expect(pending.service.addStory('week-1', story)).rejects.toMatchObject({ code: 'MARKETING_SOURCE_NOT_APPROVED' });
    await expect(pending.service.createWeek({ weekStart: '2026-07-21' })).rejects.toMatchObject({ code: 'INVALID_WEEK_START' });
    await expect(pending.service.addStory('week-1', { ...story, scheduledDate: '2026-07-27' })).rejects.toMatchObject({ code: 'MARKETING_DATE_OUTSIDE_WEEK' });
  });

  it('renders locally, requires every Story ready for approval and returns approved weeks to draft after edits', async () => {
    const { service, renderer } = await fixture();
    await service.createWeek({ weekStart: '2026-07-20' });
    await service.addStory('week-1', story);
    await expect(service.approveWeek('week-1')).rejects.toMatchObject({ code: 'MARKETING_STORIES_NOT_READY' });
    const rendered = await service.renderStory('week-1', 'story-1');
    expect(renderer).toHaveBeenCalledTimes(1);
    expect(rendered.stories[0]).toMatchObject({ renderStatus: 'ready', editorialStatus: 'ready', renderedAssetFileName: 'story-1.webp', renderedDimensions: { width: 1080, height: 1920 } });
    expect((await service.approveWeek('week-1')).status).toBe('approved');
    const edited = await service.updateStory('week-1', 'story-1', { headline: 'Nova chamada' });
    expect(edited.status).toBe('draft');
    expect(edited.stories[0]).toMatchObject({ renderStatus: 'pending', renderedAssetFileName: null, renderedDimensions: null });
  });

  it('builds the same balanced proposal every time, with priorities first and no repeated Result', async () => {
    const first = await fixture();
    await first.service.createWeek({ weekStart: '2026-07-20' });
    const input = { items: [
      { sourceResultId: 'result-1', productLabel: 'Camisa', priority: false },
      { sourceResultId: 'result-2', productLabel: 'Bolsa', priority: true },
      { sourceResultId: 'result-3', productLabel: 'Tênis', priority: false },
    ] };
    const proposed = await first.service.proposeWeek('week-1', input);
    expect(proposed.stories.map(({ sourceResultId, priority, category, scheduledDate, scheduledTime }) => ({ sourceResultId, priority, category, scheduledDate, scheduledTime }))).toEqual([
      { sourceResultId: 'result-2', priority: true, category: 'bolsas', scheduledDate: '2026-07-20', scheduledTime: '10:00' },
      { sourceResultId: 'result-1', priority: false, category: 'moda-masculina', scheduledDate: '2026-07-21', scheduledTime: '10:00' },
      { sourceResultId: 'result-3', priority: false, category: 'tenis-masculino', scheduledDate: '2026-07-22', scheduledTime: '10:00' },
    ]);
    await expect(first.service.proposeWeek('week-1', input)).rejects.toMatchObject({ code: 'MARKETING_PROPOSAL_REQUIRES_EMPTY_WEEK' });

    const duplicate = await fixture();
    await duplicate.service.createWeek({ weekStart: '2026-07-20' });
    await expect(duplicate.service.proposeWeek('week-1', { items: [input.items[0], input.items[0]] })).rejects.toMatchObject({ code: 'DUPLICATE_MARKETING_SOURCE' });

    const products = await fixture();
    await products.service.createWeek({ weekStart: '2026-07-20' });
    const alternated = await products.service.proposeWeek('week-1', { items: [
      { sourceResultId: 'result-1', productLabel: 'Produto repetido' },
      { sourceResultId: 'result-2', productLabel: 'Produto repetido' },
      { sourceResultId: 'result-3', productLabel: 'Produto alternativo' },
    ] });
    expect(alternated.stories.map(({ productLabel }) => productLabel)).toEqual(['Produto repetido', 'Produto alternativo', 'Produto repetido']);
  });

  it('supports editorial publication and makes a closed week read-only', async () => {
    const { service } = await fixture();
    await service.createWeek({ weekStart: '2026-07-20' });
    await service.addStory('week-1', story);
    await expect(service.setEditorialStatus('week-1', 'story-1', 'published')).rejects.toMatchObject({ code: 'MARKETING_STORY_NOT_READY' });
    await service.renderStory('week-1', 'story-1');
    expect((await service.setEditorialStatus('week-1', 'story-1', 'published')).stories[0]).toMatchObject({ editorialStatus: 'published', publishedAt: '2026-07-20T12:00:00.000Z' });
    await service.approveWeek('week-1');
    const closed = await service.closeWeek('week-1');
    expect(closed).toMatchObject({ status: 'closed', closedAt: '2026-07-20T12:00:00.000Z' });
    await expect(service.updateStory('week-1', 'story-1', { headline: 'Bloqueado' })).rejects.toMatchObject({ code: 'MARKETING_WEEK_CLOSED' });
    await expect(service.deleteWeek('week-1')).resolves.toEqual({ deleted: true, id: 'week-1' });
  });

  it('renders from the copied source after the original Result becomes unavailable', async () => {
    const { service, resultService, renderer } = await fixture();
    await service.createWeek({ weekStart: '2026-07-20' });
    await service.addStory('week-1', story);
    resultService.get.mockRejectedValue(new Error('Resultado removido'));

    await expect(service.renderStory('week-1', 'story-1')).resolves.toMatchObject({
      stories: [expect.objectContaining({ renderStatus: 'ready' })],
    });
    expect(resultService.get).toHaveBeenCalledTimes(1);
    expect(renderer).toHaveBeenCalledWith(expect.objectContaining({ sourceBuffer: Buffer.from('bytes-result') }));
  });

  it('persists a safe failed state without retrying when rendering fails', async () => {
    const fixtureValue = await fixture();
    await fixtureValue.service.createWeek({ weekStart: '2026-07-20' });
    await fixtureValue.service.addStory('week-1', story);
    await fixtureValue.service.renderStory('week-1', 'story-1');
    expect(await fixtureValue.repository.readAsset('week-1', 'stories', 'story-1.webp')).toEqual(Buffer.from('rendered'));
    fixtureValue.renderer.mockRejectedValueOnce(Object.assign(new Error('Falha segura'), { code: 'STORY_RENDER_FAILED' }));
    await expect(fixtureValue.service.renderStory('week-1', 'story-1')).rejects.toThrow('Falha segura');
    expect(fixtureValue.renderer).toHaveBeenCalledTimes(2);
    expect((await fixtureValue.service.getWeek('week-1')).stories[0]).toMatchObject({ renderStatus: 'failed', renderedAssetFileName: null, renderedDimensions: null, renderError: { code: 'STORY_RENDER_FAILED', message: 'Falha segura' } });
    await expect(fixtureValue.repository.readAsset('week-1', 'stories', 'story-1.webp')).rejects.toMatchObject({ code: 'MARKETING_ASSET_NOT_FOUND' });
  });
});
