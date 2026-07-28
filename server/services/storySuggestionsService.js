import { layoutStoryText, normalizeStoryText } from '../../shared/storyTextLayout.js';
import { STORY_DEFAULT_TYPOGRAPHY, STORY_TYPOGRAPHY_IDS, getStoryTypographyPreset } from '../../shared/storyTypographySpec.js';
import { AppError } from '../utils/errors.js';

const GOALS = new Set(['novidade', 'oferta', 'desejo', 'qualidade', 'look', 'presente', 'ultimas-unidades', 'whatsapp']);
const TONES = new Set(['premium', 'direto', 'elegante', 'urgente', 'descontraído']);
const TYPOGRAPHY_PRESETS = new Set(STORY_TYPOGRAPHY_IDS);

export function createStorySuggestionsService({ deepSeekKeyStore, getModelId = () => 'deepseek-v4-flash', fetchImpl = globalThis.fetch, baseUrl = 'https://api.deepseek.com', timeoutMs = 15_000 } = {}) {
  async function suggest(input, { signal: externalSignal } = {}) {
    const request = validateInput(input);
    const modelId = await getModelId();
    if (typeof modelId !== 'string' || !modelId) throw new AppError('DEEPSEEK_MODEL_UNAVAILABLE', 'O modelo DeepSeek selecionado não está disponível.', { status: 409 });
    let apiKey = await deepSeekKeyStore.getKey();
    if (!apiKey) throw new AppError('DEEPSEEK_NOT_CONFIGURED', 'Configure a chave do DeepSeek em Configurações antes de gerar sugestões.', { status: 409 });
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (externalSignal?.aborted) abort();
    externalSignal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
    try {
      if (controller.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model: modelId, temperature: 0.7, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemPrompt(request.typographyPreset) }, { role: 'user', content: JSON.stringify(request) }] }),
      });
      if (response.status === 401 || response.status === 403) throw new AppError('DEEPSEEK_SUGGESTIONS_UNAUTHORIZED', 'A chave do DeepSeek não foi aceita. Verifique-a em Configurações.', { status: 401 });
      if (!response.ok) throw new AppError('DEEPSEEK_SUGGESTIONS_FAILED', 'Não foi possível gerar sugestões agora. Tente novamente manualmente.', { status: 503 });
      const body = await response.json().catch(() => null);
      return validateResponse(body?.choices?.[0]?.message?.content, request.marketingGoal, request.typographyPreset);
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (timedOut) throw new AppError('DEEPSEEK_SUGGESTIONS_TIMEOUT', 'A geração de sugestões demorou mais que o esperado.', { status: 504 });
        throw new AppError('DEEPSEEK_SUGGESTIONS_CANCELLED', 'A geração de sugestões foi cancelada.', { status: 499 });
      }
      if (error instanceof AppError) throw error;
      throw new AppError('DEEPSEEK_SUGGESTIONS_FAILED', 'Não foi possível gerar sugestões agora. Tente novamente manualmente.', { status: 503, cause: error });
    } finally {
      apiKey = null;
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abort);
    }
  }
  return Object.freeze({ suggest });
}

function validateInput(input = {}) {
  const productLabel = clean(input.productLabel, 80, 'Informe o produto antes de gerar sugestões.');
  const sourceCategory = cleanOptional(input.sourceCategory, 80);
  const priceText = cleanOptional(input.priceText, 20);
  const additionalInstruction = cleanOptional(input.additionalInstruction, 300);
  if (!GOALS.has(input.marketingGoal)) throw new AppError('INVALID_MARKETING_GOAL', 'Selecione um objetivo de marketing disponível.', { status: 400 });
  if (!TONES.has(input.tone)) throw new AppError('INVALID_MARKETING_TONE', 'Selecione um tom de voz disponível.', { status: 400 });
  const typographyPreset = String(input.typographyPreset || STORY_DEFAULT_TYPOGRAPHY);
  if (!TYPOGRAPHY_PRESETS.has(typographyPreset)) throw new AppError('INVALID_STORY_TYPOGRAPHY_PRESET', 'Selecione um estilo tipográfico disponível.', { status: 400 });
  return { productLabel, sourceCategory, priceText, marketingGoal: input.marketingGoal, tone: input.tone, typographyPreset, additionalInstruction };
}

function validateResponse(content, marketingGoal, typographyPreset) {
  let parsed;
  try { parsed = JSON.parse(content); } catch { throw new AppError('DEEPSEEK_SUGGESTIONS_INVALID', 'O DeepSeek retornou sugestões em formato inválido. Tente novamente manualmente.', { status: 502 }); }
  if (!Array.isArray(parsed?.suggestions) || parsed.suggestions.length !== 3) throw new AppError('DEEPSEEK_SUGGESTIONS_INVALID', 'O DeepSeek não retornou exatamente três sugestões válidas.', { status: 502 });
  const suggestions = parsed.suggestions.map((item) => validateSuggestion(item, marketingGoal, typographyPreset));
  return { suggestions };
}

function validateSuggestion(item, marketingGoal, typographyPreset) {
  const suggestion = {
    calloutText: cleanSuggestionField(item?.calloutText, 48),
    headline: cleanSuggestionField(item?.headline, 48),
    subheadline: cleanSuggestionField(item?.subheadline, 80),
    ctaText: cleanSuggestionField(item?.ctaText, 28),
  };
  for (const field of ['calloutText', 'headline', 'subheadline', 'ctaText']) {
    if (layoutStoryText(suggestion[field], field, typographyPreset).blocked) throw new AppError('DEEPSEEK_SUGGESTIONS_INVALID', 'Uma sugestão excede os limites seguros do Story.', { status: 502 });
  }
  const text = Object.values(suggestion).join(' ').toLowerCase();
  if (/(desconto|\b\d+%\b|frete|entrega|prazo|cart[aã]o|parcel)/.test(text)) throw new AppError('DEEPSEEK_SUGGESTIONS_INVALID', 'Uma sugestão contém condição comercial não informada.', { status: 502 });
  if (marketingGoal !== 'ultimas-unidades' && /(últimas unidades|ultimas unidades|estoque|restam)/.test(text)) throw new AppError('DEEPSEEK_SUGGESTIONS_INVALID', 'Uma sugestão menciona estoque sem o objetivo correspondente.', { status: 502 });
  return suggestion;
}

function clean(value, max, message) { const text = cleanOptional(value, max); if (!text) throw new AppError('INVALID_STORY_SUGGESTION_INPUT', message, { status: 400 }); return text; }
function cleanOptional(value, max) { return normalizeStoryText(value).replace(/[\u0000-\u001f]/g, '').slice(0, max); }
function cleanSuggestionField(value, max) {
  if (typeof value !== 'string') throw new AppError('DEEPSEEK_SUGGESTIONS_INVALID', 'O DeepSeek retornou um campo de sugestão inválido.', { status: 502 });
  const text = normalizeStoryText(value).replace(/[\u0000-\u001f]/g, '');
  if (text.length > max) throw new AppError('DEEPSEEK_SUGGESTIONS_INVALID', 'Uma sugestão excede os limites seguros do Story.', { status: 502 });
  return text;
}

function systemPrompt(typographyPreset) {
  const typography = getStoryTypographyPreset(typographyPreset);
  return `Você escreve textos curtos em português do Brasil para Stories da PRIME STORE. Retorne JSON puro no formato {"suggestions":[{"calloutText":"","headline":"","subheadline":"","ctaText":""}]}. Gere exatamente 3 sugestões distintas. Headline até 4 palavras, subheadline até 8, CTA até 3. O estilo tipográfico selecionado é ${typography.label}; adeque a cadência e concisão a esse estilo, mas retorne exatamente os mesmos quatro campos. Não invente preço, desconto, estoque, frete, prazo ou condições. Só use “últimas unidades” se esse for o objetivo. Evite texto genérico e repetição.`;
}
