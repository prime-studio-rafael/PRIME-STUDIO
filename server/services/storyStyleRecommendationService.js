import { getTemplateCategoryById, isKnownTemplateCategory } from '../catalogs/templateCategories.js';
import { AppError } from '../utils/errors.js';
import { STORY_RECOMMENDATION_GOALS, STORY_RECOMMENDATION_TONES, listStoryVisualStyles } from '../../shared/storyVisualStyleSpec.js';
import { normalizeStoryText } from '../../shared/storyTextLayout.js';

const ALLOWED_FIELDS = new Set(['productLabel', 'sourceCategory', 'priceText', 'marketingGoal', 'tone', 'priority', 'headline', 'subheadline', 'additionalInstruction']);
const GOAL_LABELS = Object.freeze({ novidade: 'novidade', oferta: 'oferta', desejo: 'desejo', qualidade: 'qualidade', look: 'look', presente: 'presente', 'ultimas-unidades': 'últimas unidades', whatsapp: 'conversa no WhatsApp' });
const TONE_LABELS = Object.freeze({ premium: 'tom premium', direto: 'tom direto', elegante: 'tom elegante', urgente: 'tom urgente', descontraído: 'tom descontraído' });

export function createStoryStyleRecommendationService({ deepSeekKeyStore, getModelId = () => 'deepseek-v4-flash', fetchImpl = globalThis.fetch, baseUrl = 'https://api.deepseek.com', timeoutMs = 15_000 } = {}) {
  async function recommend(input, { signal: externalSignal } = {}) {
    const request = validateInput(input);
    const local = localRecommendation(request);
    if (externalSignal?.aborted) throw cancelledError();

    let apiKey = null;
    try {
      const modelId = await getModelId();
      apiKey = await deepSeekKeyStore?.getKey?.();
      if (!apiKey || typeof modelId !== 'string' || !modelId) return local;
      return await deepSeekRecommendation({ request, local, modelId, apiKey, fetchImpl, baseUrl, timeoutMs, externalSignal });
    } catch (error) {
      if (error?.code === 'STORY_STYLE_RECOMMENDATION_CANCELLED' || externalSignal?.aborted) throw cancelledError();
      return local;
    } finally { apiKey = null; }
  }

  return Object.freeze({ recommend, localRecommendation: (input) => localRecommendation(validateInput(input)) });
}

export function localRecommendation(request) {
  const ranked = listStoryVisualStyles().map((style, index) => ({ style, index, score: scoreStyle(style, request) })).sort((left, right) => right.score - left.score || left.index - right.index);
  const [primary, ...rest] = ranked;
  return Object.freeze({ source: 'local-fallback', recommendedStyleId: primary.style.id, reason: localReason(primary.style, request), alternatives: Object.freeze(rest.slice(0, 2).map(({ style }) => Object.freeze({ styleId: style.id, reason: localReason(style, request) }))) });
}

async function deepSeekRecommendation({ request, local, modelId, apiKey, fetchImpl, baseUrl, timeoutMs, externalSignal }) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  externalSignal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  try {
    const candidates = [local.recommendedStyleId, ...local.alternatives.map((item) => item.styleId)].map((id) => listStoryVisualStyles().find((style) => style.id === id));
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: modelId, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemPrompt() }, { role: 'user', content: JSON.stringify({ context: request, candidates: candidates.map(publicStyle) }) }] }),
    });
    if (!response.ok) throw new Error(`DeepSeek status ${response.status}`);
    const body = await response.json().catch(() => null);
    return Object.freeze({ source: 'deepseek', ...validateDeepSeekResponse(body?.choices?.[0]?.message?.content, candidates) });
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (externalSignal?.aborted && !timedOut) throw cancelledError();
      throw new Error('DeepSeek timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abort);
  }
}

function validateInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('INVALID_STYLE_RECOMMENDATION_INPUT', 'Os dados para recomendação são inválidos.', { status: 400 });
  if (Object.keys(input).some((key) => !ALLOWED_FIELDS.has(key))) throw new AppError('INVALID_STYLE_RECOMMENDATION_INPUT', 'A recomendação aceita somente dados textuais permitidos do Story.', { status: 400 });
  const sourceCategory = optional(input.sourceCategory, 80) || 'sem-categoria';
  if (!isKnownTemplateCategory(sourceCategory)) throw new AppError('INVALID_STYLE_RECOMMENDATION_CATEGORY', 'Selecione uma categoria válida para recomendar um estilo.', { status: 400 });
  const marketingGoal = String(input.marketingGoal || '');
  const tone = String(input.tone || '');
  if (!STORY_RECOMMENDATION_GOALS.includes(marketingGoal)) throw new AppError('INVALID_STYLE_RECOMMENDATION_GOAL', 'Selecione um objetivo de marketing válido.', { status: 400 });
  if (!STORY_RECOMMENDATION_TONES.includes(tone)) throw new AppError('INVALID_STYLE_RECOMMENDATION_TONE', 'Selecione um tom de voz válido.', { status: 400 });
  if (typeof input.priority !== 'boolean') throw new AppError('INVALID_STYLE_RECOMMENDATION_PRIORITY', 'A prioridade do produto é inválida.', { status: 400 });
  return Object.freeze({ productLabel: required(input.productLabel, 80), sourceCategory, priceText: optional(input.priceText, 20), marketingGoal, tone, priority: input.priority, headline: optional(input.headline, 48), subheadline: optional(input.subheadline, 80), additionalInstruction: optional(input.additionalInstruction, 300) });
}

function scoreStyle(style, request) {
  const signal = style.recommendation;
  let score = 0;
  if (signal.categories.includes(request.sourceCategory)) score += 4;
  if (signal.marketingGoals.includes(request.marketingGoal)) score += 4;
  if (signal.tones.includes(request.tone)) score += 3;
  if (request.priority && signal.priorityPreference === 'prefer') score += 2;
  if (request.priceText && signal.priceEmphasis === 'prefer-present') score += 3;
  return score;
}

function localReason(style, request) {
  const signal = style.recommendation;
  const category = getTemplateCategoryById(request.sourceCategory)?.label;
  if (signal.marketingGoals.includes(request.marketingGoal)) return `Combina com comunicação de ${GOAL_LABELS[request.marketingGoal]}.`;
  if (signal.tones.includes(request.tone)) return `Combina com ${TONE_LABELS[request.tone]}.`;
  if (signal.categories.includes(request.sourceCategory) && category) return `Adequado à categoria ${category}.`;
  if (request.priceText && signal.priceEmphasis === 'prefer-present') return 'Dá destaque ao preço informado.';
  if (request.priority && signal.priorityPreference === 'prefer') return 'Valoriza este produto prioritário.';
  return 'Opção equilibrada para os dados informados.';
}

function publicStyle(style) { return { id: style.id, label: style.label, description: style.description, recommendedFor: style.recommendedFor }; }

function validateDeepSeekResponse(content, candidates) {
  let parsed;
  try { parsed = JSON.parse(content); } catch { throw new Error('DeepSeek JSON invalid'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some((key) => !['recommendedStyleId', 'reason', 'alternatives'].includes(key))) throw new Error('DeepSeek response invalid');
  const candidateIds = new Set(candidates.map((style) => style.id));
  const recommendedStyleId = String(parsed.recommendedStyleId || '');
  if (!candidateIds.has(recommendedStyleId)) throw new Error('DeepSeek style invalid');
  const reason = validateReason(parsed.reason);
  if (!Array.isArray(parsed.alternatives) || parsed.alternatives.length > 2) throw new Error('DeepSeek alternatives invalid');
  const seen = new Set([recommendedStyleId]);
  const alternatives = parsed.alternatives.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some((key) => !['styleId', 'reason'].includes(key))) throw new Error('DeepSeek alternative invalid');
    const styleId = String(item.styleId || '');
    if (!candidateIds.has(styleId) || seen.has(styleId)) throw new Error('DeepSeek alternative duplicated');
    seen.add(styleId);
    return Object.freeze({ styleId, reason: validateReason(item.reason) });
  });
  return Object.freeze({ recommendedStyleId, reason, alternatives: Object.freeze(alternatives) });
}

function validateReason(value) {
  if (typeof value !== 'string') throw new Error('DeepSeek reason invalid');
  const reason = normalizeStoryText(value).replace(/[\u0000-\u001f]/g, '');
  if (reason.length < 8 || reason.length > 180 || /https?:\/\//i.test(reason)) throw new Error('DeepSeek reason invalid');
  return reason;
}

function required(value, max) { const result = optional(value, max); if (!result) throw new AppError('INVALID_STYLE_RECOMMENDATION_INPUT', 'Informe o produto antes de pedir uma recomendação.', { status: 400 }); return result; }
function optional(value, max) { return normalizeStoryText(value).replace(/[\u0000-\u001f]/g, '').slice(0, max); }
function cancelledError() { return new AppError('STORY_STYLE_RECOMMENDATION_CANCELLED', 'A recomendação de estilo foi cancelada.', { status: 499 }); }
function systemPrompt() { return 'Você recomenda um estilo visual para Stories da PRIME STORE. Retorne JSON puro e exato: {"recommendedStyleId":"","reason":"","alternatives":[{"styleId":"","reason":""}]}. Escolha somente IDs presentes em candidates, sem repetir o principal. Use no máximo duas alternativas e motivos curtos em português do Brasil. Não crie estilos, não invente dados comerciais, não descreva geometria nem retorne campos extras.'; }
