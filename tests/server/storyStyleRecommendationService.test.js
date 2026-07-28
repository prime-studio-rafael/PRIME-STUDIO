// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createStoryStyleRecommendationService } from '../../server/services/storyStyleRecommendationService.js';

const input = Object.freeze({ productLabel: 'Tênis Prime', sourceCategory: 'tenis-masculino', priceText: 'R$ 499', marketingGoal: 'oferta', tone: 'urgente', priority: true, headline: 'Oferta especial', subheadline: 'Condição informada', additionalInstruction: '' });
const keyStore = (key = '') => ({ getKey: vi.fn(async () => key) });

describe('storyStyleRecommendationService', () => {
  it('ranks official styles deterministically without a key or network', async () => {
    const fetchImpl = vi.fn();
    const service = createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore(''), fetchImpl });
    const first = await service.recommend(input);
    const second = await service.recommend(input);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ source: 'local-fallback', recommendedStyleId: 'offer' });
    expect(first.alternatives).toHaveLength(2);
    expect(new Set([first.recommendedStyleId, ...first.alternatives.map((item) => item.styleId)]).size).toBe(3);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses category, goal, tone and priority while accepting absent optional text fields', async () => {
    const service = createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore(''), fetchImpl: vi.fn() });
    const luxury = await service.recommend({ productLabel: 'Bolsa Prime', sourceCategory: 'bolsas', priceText: '', marketingGoal: 'desejo', tone: 'elegante', priority: true, headline: '', subheadline: '', additionalInstruction: '' });
    expect(luxury).toMatchObject({ source: 'local-fallback', recommendedStyleId: 'luxury' });
    expect(luxury.reason).toMatch(/desejo|elegante|Bolsas|prioritário/i);
  });

  it('makes exactly one structured DeepSeek call using only text and valid candidate ids', async () => {
    const response = { recommendedStyleId: 'offer', reason: 'Combina com oferta e comunicação urgente.', alternatives: [{ styleId: 'luxury', reason: 'Mantém presença mais exclusiva.' }, { styleId: 'prime-store', reason: 'Mantém uma alternativa equilibrada.' }] };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(response) } }] }), { status: 200 }));
    const service = createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore('server-only-secret'), fetchImpl });
    await expect(service.recommend(input)).resolves.toEqual({ source: 'deepseek', ...response });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(JSON.stringify(payload)).not.toContain('server-only-secret');
    expect(JSON.stringify(payload)).not.toMatch(/base64|image|data:image/i);
    expect(payload.messages[1].content).toContain('offer');
  });

  it('falls back locally for invalid responses and network failures without retrying', async () => {
    const duplicate = { recommendedStyleId: 'offer', reason: 'Combina com oferta e comunicação urgente.', alternatives: [{ styleId: 'offer', reason: 'Duplicada de propósito.' }] };
    const invalidFetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(duplicate) } }] }), { status: 200 }));
    const service = createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore('secret'), fetchImpl: invalidFetch });
    await expect(service.recommend(input)).resolves.toMatchObject({ source: 'local-fallback', recommendedStyleId: 'offer' });
    expect(invalidFetch).toHaveBeenCalledTimes(1);
    const offline = vi.fn(async () => { throw new Error('offline'); });
    await expect(createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore('secret'), fetchImpl: offline }).recommend(input)).resolves.toMatchObject({ source: 'local-fallback' });
    expect(offline).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['JSON inválido', 'não é JSON'],
    ['ID desconhecido', JSON.stringify({ recommendedStyleId: 'inventado', reason: 'Motivo válido para a recomendação.', alternatives: [] })],
    ['principal repetido', JSON.stringify({ recommendedStyleId: 'offer', reason: 'Combina com oferta e comunicação urgente.', alternatives: [{ styleId: 'offer', reason: 'Não deveria repetir o principal.' }] })],
  ])('falls back locally for %s without retrying', async (_label, content) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
    const result = await createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore('secret'), fetchImpl }).recommend(input);
    expect(result).toMatchObject({ source: 'local-fallback', recommendedStyleId: 'offer' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('uses the local fallback after a timeout without retrying', async () => {
    const timeout = vi.fn(async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) )));
    const result = await createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore('secret'), fetchImpl: timeout, timeoutMs: 20 }).recommend(input);
    expect(result).toMatchObject({ source: 'local-fallback', recommendedStyleId: 'offer' });
    expect(timeout).toHaveBeenCalledTimes(1);
  });

  it('cancels without a fallback and rejects unsupported payload fields before requesting', async () => {
    const controller = new AbortController();
    const pending = vi.fn(async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) )));
    const service = createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore('secret'), fetchImpl: pending, timeoutMs: 1_000 });
    const result = service.recommend(input, { signal: controller.signal }); result.catch(() => {});
    await vi.waitFor(() => expect(pending).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: 'STORY_STYLE_RECOMMENDATION_CANCELLED' });
    const unused = vi.fn();
    await expect(createStoryStyleRecommendationService({ deepSeekKeyStore: keyStore('secret'), fetchImpl: unused }).recommend({ ...input, image: 'not-allowed' })).rejects.toMatchObject({ code: 'INVALID_STYLE_RECOMMENDATION_INPUT' });
    expect(unused).not.toHaveBeenCalled();
  });
});
