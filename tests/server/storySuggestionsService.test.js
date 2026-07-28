// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createStorySuggestionsService } from '../../server/services/storySuggestionsService.js';

const input = { productLabel: 'Bolsa Prime', sourceCategory: 'Bolsas', priceText: 'R$ 299', marketingGoal: 'novidade', tone: 'premium', additionalInstruction: '' };
const valid = { suggestions: [
  { calloutText: 'Novo destaque', headline: 'Bolsa Prime', subheadline: 'Elegância para todos os momentos', ctaText: 'Saiba mais' },
  { calloutText: 'Chegou agora', headline: 'Seu novo acessório', subheadline: 'Design que completa o look', ctaText: 'Conheça agora' },
  { calloutText: 'Estilo em foco', headline: 'Detalhes que encantam', subheadline: 'Uma escolha elegante para você', ctaText: 'Ver coleção' },
] };

function service(fetchImpl, key = 'server-only-secret', timeoutMs = 20) { return createStorySuggestionsService({ deepSeekKeyStore: { getKey: vi.fn(async () => key) }, fetchImpl, timeoutMs }); }

describe('storySuggestionsService', () => {
  it('makes exactly one structured DeepSeek call and returns exactly three suggestions', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(valid) } }] }), { status: 200 }));
    await expect(service(fetchImpl).suggest(input)).resolves.toEqual(valid);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions');
    expect(fetchImpl.mock.calls[0][1].body).toContain('deepseek-v4-flash');
    expect(fetchImpl.mock.calls[0][1].body).toContain('Bolsa Prime');
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(JSON.parse(payload.messages[1].content).typographyPreset).toBe('premium');
    expect(payload.messages[0].content).toContain('Premium');
  });

  it('blocks absent keys, invalid payloads and commercial claims without retrying', async () => {
    const unused = vi.fn();
    await expect(service(unused, '').suggest(input)).rejects.toMatchObject({ code: 'DEEPSEEK_NOT_CONFIGURED' });
    expect(unused).not.toHaveBeenCalled();
    const invalid = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ suggestions: valid.suggestions.slice(0, 2) }) } }] }), { status: 200 }));
    await expect(service(invalid).suggest(input)).rejects.toMatchObject({ code: 'DEEPSEEK_SUGGESTIONS_INVALID' });
    expect(invalid).toHaveBeenCalledTimes(1);
    const inventedPayload = {
      choices: [{
        message: {
          content: JSON.stringify({
            suggestions: valid.suggestions.map((item) => ({ ...item, headline: '20% de desconto' })),
          }),
        },
      }],
    };
    const invented = vi.fn(async () => new Response(JSON.stringify(inventedPayload), { status: 200 }));
    await expect(service(invented).suggest(input)).rejects.toMatchObject({ code: 'DEEPSEEK_SUGGESTIONS_INVALID' });
    const tooLongPayload = {
      choices: [{
        message: {
          content: JSON.stringify({
            suggestions: valid.suggestions.map((item) => ({ ...item, headline: 'uma headline muito longa que não cabe no Story' })),
          }),
        },
      }],
    };
    const tooLong = vi.fn(async () => new Response(JSON.stringify(tooLongPayload), { status: 200 }));
    await expect(service(tooLong).suggest(input)).rejects.toMatchObject({ code: 'DEEPSEEK_SUGGESTIONS_INVALID' });
    expect(tooLong).toHaveBeenCalledTimes(1);
  });

  it('maps timeout and network failure without retrying', async () => {
    const timeout = vi.fn(async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await expect(service(timeout).suggest(input)).rejects.toMatchObject({ code: 'DEEPSEEK_SUGGESTIONS_TIMEOUT' });
    expect(timeout).toHaveBeenCalledTimes(1);
    const offline = vi.fn(async () => { throw new Error('offline'); });
    await expect(service(offline).suggest(input)).rejects.toMatchObject({ code: 'DEEPSEEK_SUGGESTIONS_FAILED' });
    expect(offline).toHaveBeenCalledTimes(1);
  });

  it('cancels an in-flight request without retrying', async () => {
    const controller = new AbortController();
    const pending = vi.fn(async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const result = service(pending, 'server-only-secret', 1_000).suggest(input, { signal: controller.signal });
    result.catch(() => {});
    await vi.waitFor(() => expect(pending).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: 'DEEPSEEK_SUGGESTIONS_CANCELLED' });
    expect(pending).toHaveBeenCalledTimes(1);
  });

  it('accepts only approved typography presets without making a request for invalid values', async () => {
    const fetchImpl = vi.fn();
    await expect(service(fetchImpl).suggest({ ...input, typographyPreset: 'arbitrary-font' })).rejects.toMatchObject({ code: 'INVALID_STORY_TYPOGRAPHY_PRESET' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
