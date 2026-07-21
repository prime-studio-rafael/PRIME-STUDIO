import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors.js';
import { STORY_TEMPLATES, getStoryTemplate } from '../catalogs/storyTemplates.js';
import { DEFAULT_TEMPLATE_CATEGORY_ID, getTemplateCategoryById } from '../catalogs/templateCategories.js';
import { renderStory as defaultRenderStory } from './storyRenderer.js';

const SCHEMA_VERSION = 1;
const TIMEZONE = 'America/Sao_Paulo';
const EXTENSIONS = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });
const VARIANTS = new Set(['original', 'branded']);
const EDITORIAL_STATUSES = new Set(['planned', 'ready', 'published']);
const PROPOSAL_TIMES = Object.freeze(['10:00', '15:00', '19:00']);
const MAX_PROPOSAL_ITEMS = 21;

export function createMarketingService({ repository, resultService, brandingService, renderStory = defaultRenderStory, uuid = randomUUID, now = () => new Date() } = {}) {
  if (!repository || !resultService || !brandingService) throw new TypeError('MarketingService requires repository, resultService and brandingService.');
  const resolveApprovedSource = createSourceResolver(resultService);

  async function listSources() {
    const results = await resultService.list();
    return results.filter((result) => result.reviewStatus === 'approved').map((result) => ({
      id: result.id,
      createdAt: result.createdAt,
      templateLabel: result.templateLabel,
      productHint: result.templateLabel,
      category: result.templateCategory || DEFAULT_TEMPLATE_CATEGORY_ID,
      categoryLabel: categoryLabel(result.templateCategory),
      originalAvailable: Boolean(result.assets?.result),
      brandedAvailable: Boolean(result.assets?.branded),
      previewUrl: result.assets?.branded || result.assets?.result,
      variants: [result.assets?.result ? 'original' : null, result.assets?.branded ? 'branded' : null].filter(Boolean),
    }));
  }

  async function createWeek({ weekStart }) {
    assertMonday(weekStart);
    if ((await repository.list()).some((week) => week.weekStart === weekStart)) {
      throw new AppError('MARKETING_WEEK_ALREADY_EXISTS', 'Já existe um planejamento para esta semana.', { status: 409 });
    }
    const timestamp = now().toISOString();
    return repository.create({ schemaVersion: SCHEMA_VERSION, id: uuid(), weekStart, timezone: TIMEZONE, status: 'draft', createdAt: timestamp, updatedAt: timestamp, approvedAt: null, closedAt: null, stories: [] });
  }

  async function updateWeek(id, { weekStart }) {
    assertMonday(weekStart);
    return repository.update(id, (week) => {
      assertWeekMutable(week);
      for (const story of week.stories) assertDateInWeek(story.scheduledDate, weekStart);
      return touchDraft({ ...week, weekStart }, now);
    });
  }

  async function approveWeek(id) {
    return repository.update(id, (week) => {
      assertWeekMutable(week);
      if (!week.stories.length) throw new AppError('MARKETING_EMPTY_WEEK', 'Adicione pelo menos um Story antes de aprovar a semana.', { status: 422 });
      if (week.stories.some((story) => story.renderStatus !== 'ready')) throw new AppError('MARKETING_STORIES_NOT_READY', 'Renderize todos os Stories antes de aprovar a semana.', { status: 422 });
      const timestamp = now().toISOString();
      return { ...week, status: 'approved', approvedAt: timestamp, updatedAt: timestamp };
    });
  }

  async function returnToDraft(id) {
    return repository.update(id, (week) => { assertWeekMutable(week); return touchDraft(week, now); });
  }

  async function closeWeek(id) {
    return repository.update(id, (week) => {
      if (week.status !== 'approved') throw new AppError('MARKETING_WEEK_NOT_APPROVED', 'Aprove a semana antes de encerrá-la.', { status: 422 });
      const timestamp = now().toISOString();
      return { ...week, status: 'closed', closedAt: timestamp, updatedAt: timestamp };
    });
  }

  async function addStory(weekId, input) {
    const storyInput = validateStoryInput(input);
    const existingWeek = await repository.get(weekId);
    assertWeekMutable(existingWeek);
    assertDateInWeek(storyInput.scheduledDate, existingWeek.weekStart);
    const source = await resolveApprovedSource(storyInput.sourceResultId, storyInput.sourceAssetVariant);
    const storyId = uuid();
    const sourceFileName = `${storyId}.${EXTENSIONS[source.mimeType]}`;
    await repository.writeAsset(weekId, 'sources', sourceFileName, source.buffer);
    const timestamp = now().toISOString();
    const story = createStoryRecord({ id: storyId, input: storyInput, source, sourceFileName, timestamp });
    try {
      return await repository.update(weekId, (week) => {
        assertDateInWeek(story.scheduledDate, week.weekStart);
        return touchDraft({ ...week, stories: sortStories([...week.stories, story]) }, now);
      });
    } catch (error) {
      await repository.deleteAsset(weekId, 'sources', sourceFileName);
      throw error;
    }
  }

  async function updateStory(weekId, storyId, input) {
    const currentWeek = await repository.get(weekId);
    assertWeekMutable(currentWeek);
    const current = findStory(currentWeek, storyId);
    const merged = validateStoryInput({ ...current, ...input });
    const sourceChanged = merged.sourceResultId !== current.sourceResultId || merged.sourceAssetVariant !== current.sourceAssetVariant;
    let nextSourceFileName = current.sourceAssetFileName;
    let nextSourceResult = null;
    if (sourceChanged) {
      const source = await resolveApprovedSource(merged.sourceResultId, merged.sourceAssetVariant);
      nextSourceResult = source.result;
      nextSourceFileName = `${storyId}-${uuid()}.${EXTENSIONS[source.mimeType]}`;
      await repository.writeAsset(weekId, 'sources', nextSourceFileName, source.buffer);
    }
    const updated = { ...current, ...merged, productKey: normalizeProductKey(merged.productLabel), category: sourceChanged ? sourceCategory(nextSourceResult) : current.category || DEFAULT_TEMPLATE_CATEGORY_ID, categoryLabel: sourceChanged ? categoryLabel(nextSourceResult.templateCategory) : current.categoryLabel || categoryLabel(current.category), sourceAssetFileName: nextSourceFileName, renderedAssetFileName: null, renderedDimensions: null, renderStatus: 'pending', editorialStatus: 'planned', publishedAt: null, renderedAt: null, renderError: null, updatedAt: now().toISOString() };
    let week;
    try {
      week = await repository.update(weekId, (candidate) => {
        assertDateInWeek(updated.scheduledDate, candidate.weekStart);
        return touchDraft({ ...candidate, stories: sortStories(candidate.stories.map((story) => story.id === storyId ? updated : story)) }, now);
      });
    } catch (error) {
      if (sourceChanged) await repository.deleteAsset(weekId, 'sources', nextSourceFileName);
      throw error;
    }
    if (sourceChanged && current.sourceAssetFileName !== nextSourceFileName) await repository.deleteAsset(weekId, 'sources', current.sourceAssetFileName);
    if (current.renderedAssetFileName) await repository.deleteAsset(weekId, 'stories', current.renderedAssetFileName);
    return week;
  }

  async function deleteStory(weekId, storyId) {
    let removed;
    const week = await repository.update(weekId, (candidate) => {
      assertWeekMutable(candidate);
      removed = findStory(candidate, storyId);
      return touchDraft({ ...candidate, stories: candidate.stories.filter((story) => story.id !== storyId) }, now);
    });
    await Promise.all([
      repository.deleteAsset(weekId, 'sources', removed.sourceAssetFileName),
      repository.deleteAsset(weekId, 'stories', removed.renderedAssetFileName),
    ]);
    return week;
  }

  async function deleteWeek(id) {
    await repository.get(id);
    return repository.delete(id);
  }

  async function render(weekId, storyId) {
    const week = await repository.get(weekId);
    assertWeekMutable(week);
    const story = findStory(week, storyId);
    try {
      const [sourceBuffer, logo] = await Promise.all([
        repository.readAsset(weekId, 'sources', story.sourceAssetFileName),
        brandingService.readLogoAsset('approved'),
      ]);
      const output = await renderStory({ sourceBuffer, logoBuffer: logo.buffer, story });
      const renderedAssetFileName = `${story.id}.webp`;
      await repository.writeAsset(weekId, 'stories', renderedAssetFileName, output.buffer);
      return repository.update(weekId, (candidate) => ({
        ...touchDraft(candidate, now),
        stories: candidate.stories.map((item) => item.id === storyId ? { ...item, renderedAssetFileName, renderStatus: 'ready', editorialStatus: 'ready', publishedAt: null, renderedAt: now().toISOString(), renderError: null, renderedDimensions: output.dimensions, updatedAt: now().toISOString() } : item),
      }));
    } catch (error) {
      await repository.update(weekId, (candidate) => ({
        ...touchDraft(candidate, now),
        stories: candidate.stories.map((item) => item.id === storyId ? { ...item, renderedAssetFileName: null, renderedDimensions: null, renderStatus: 'failed', editorialStatus: 'planned', publishedAt: null, renderedAt: null, renderError: safeRenderError(error), updatedAt: now().toISOString() } : item),
      }));
      if (story.renderedAssetFileName) await repository.deleteAsset(weekId, 'stories', story.renderedAssetFileName);
      throw error;
    }
  }

  async function setEditorialStatus(weekId, storyId, editorialStatus) {
    if (!EDITORIAL_STATUSES.has(editorialStatus)) throw new AppError('INVALID_EDITORIAL_STATUS', 'Use planned, ready ou published.', { status: 400 });
    return repository.update(weekId, (week) => {
      assertWeekMutable(week);
      const story = findStory(week, storyId);
      if (editorialStatus !== 'planned' && story.renderStatus !== 'ready') throw new AppError('MARKETING_STORY_NOT_READY', 'Renderize o Story antes de marcá-lo como pronto ou publicado.', { status: 422 });
      const timestamp = now().toISOString();
      return { ...week, updatedAt: timestamp, stories: week.stories.map((item) => item.id === storyId ? { ...item, editorialStatus, publishedAt: editorialStatus === 'published' ? timestamp : null, updatedAt: timestamp } : item) };
    });
  }

  async function proposeWeek(weekId, { items } = {}) {
    const week = await repository.get(weekId);
    assertWeekMutable(week);
    if (week.stories.length) throw new AppError('MARKETING_PROPOSAL_REQUIRES_EMPTY_WEEK', 'A proposta automática só pode ser aplicada a uma semana vazia.', { status: 409 });
    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_PROPOSAL_ITEMS) throw new AppError('INVALID_MARKETING_PROPOSAL', `Selecione entre 1 e ${MAX_PROPOSAL_ITEMS} produtos para a proposta.`, { status: 400 });
    const ids = items.map((item) => text(item.sourceResultId, 'Resultado de origem', 100, true));
    if (new Set(ids).size !== ids.length) throw new AppError('DUPLICATE_MARKETING_SOURCE', 'Cada Resultado pode aparecer apenas uma vez na proposta.', { status: 422 });
    const resolved = await Promise.all(items.map(async (item, index) => {
      const result = await resolveResult(resultService, ids[index]);
      return { sourceResultId: ids[index], productLabel: text(item.productLabel || result.templateLabel, 'Nome ou código do produto', 80, true), priority: Boolean(item.priority), category: sourceCategory(result), categoryLabel: categoryLabel(result.templateCategory), createdAt: result.createdAt || '', result };
    }));
    const ordered = deterministicProposalOrder(resolved);
    let current = week;
    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index];
      current = await addStory(weekId, { sourceResultId: item.sourceResultId, sourceAssetVariant: 'original', productLabel: item.productLabel, priority: item.priority, storyTemplateId: STORY_TEMPLATES[index % STORY_TEMPLATES.length].id, scheduledDate: addUtcDays(week.weekStart, index % 7), scheduledTime: PROPOSAL_TIMES[Math.floor(index / 7)], order: index + 1 });
    }
    return current;
  }

  async function readAsset(weekId, storyId, kind) {
    const week = await repository.get(weekId);
    const story = findStory(week, storyId);
    const fileName = kind === 'source' ? story.sourceAssetFileName : kind === 'story' ? story.renderedAssetFileName : null;
    if (!fileName) throw new AppError('MARKETING_ASSET_NOT_FOUND', 'O arquivo solicitado ainda não está disponível.', { status: 404 });
    const buffer = await repository.readAsset(weekId, kind === 'source' ? 'sources' : 'stories', fileName);
    const mimeType = kind === 'story' ? 'image/webp' : mimeFromFileName(fileName);
    return { buffer, mimeType, fileName: kind === 'story' ? `prime-story-${story.productKey}.webp` : fileName };
  }

  return Object.freeze({
    layouts: () => STORY_TEMPLATES,
    listSources,
    listWeeks: repository.list,
    getWeek: repository.get,
    createWeek,
    updateWeek,
    approveWeek,
    returnToDraft,
    closeWeek,
    deleteWeek,
    addStory,
    updateStory,
    deleteStory,
    renderStory: render,
    setEditorialStatus,
    proposeWeek,
    readAsset,
  });
}

function validateStoryInput(input) {
  const productLabel = text(input.productLabel, 'Nome ou código do produto', 80, true);
  const sourceResultId = text(input.sourceResultId, 'Resultado de origem', 100, true);
  const sourceAssetVariant = String(input.sourceAssetVariant || 'original');
  if (!VARIANTS.has(sourceAssetVariant)) throw new AppError('INVALID_MARKETING_VARIANT', 'Selecione a versão Original ou Com logo.', { status: 400 });
  const storyTemplateId = String(input.storyTemplateId || 'product-highlight');
  if (!getStoryTemplate(storyTemplateId)) throw new AppError('INVALID_STORY_TEMPLATE', 'Selecione um layout de Story válido.', { status: 400 });
  const scheduledDate = String(input.scheduledDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) throw new AppError('INVALID_MARKETING_DATE', 'Informe uma data válida para o Story.', { status: 400 });
  const scheduledTime = String(input.scheduledTime || '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) throw new AppError('INVALID_MARKETING_TIME', 'Informe um horário válido para o Story.', { status: 400 });
  const order = Number(input.order);
  if (!Number.isInteger(order) || order < 1 || order > 999) throw new AppError('INVALID_MARKETING_ORDER', 'A ordem deve ser um número inteiro entre 1 e 999.', { status: 400 });
  return { sourceResultId, sourceAssetVariant, productLabel, priority: Boolean(input.priority), priceText: text(input.priceText, 'Preço', 40), headline: text(input.headline, 'Chamada', 90), ctaText: text(input.ctaText, 'CTA', 40), storyTemplateId, scheduledDate, scheduledTime, order };
}

async function resolveResult(resultService, id) {
  const result = await resultService.get(id);
  if (result.reviewStatus !== 'approved') throw new AppError('MARKETING_SOURCE_NOT_APPROVED', 'Somente resultados aprovados podem ser usados no Marketing Studio.', { status: 422 });
  return result;
}
function createSourceResolver(resultService) {
  return async (resultId, variant) => {
    const result = await resolveResult(resultService, resultId);
    if (variant === 'branded' && !result.assets?.branded) throw new AppError('MARKETING_BRANDED_SOURCE_UNAVAILABLE', 'Este resultado não possui uma versão com Branding.', { status: 422 });
    return { ...(await resultService.readAsset(resultId, variant === 'branded' ? 'branded' : 'result')), result };
  };
}

function assertMonday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new AppError('INVALID_WEEK_START', 'Informe uma segunda-feira válida.', { status: 400 });
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCDay() !== 1) throw new AppError('INVALID_WEEK_START', 'A semana deve começar em uma segunda-feira.', { status: 400 });
}
function assertDateInWeek(value, weekStart) {
  const date = new Date(`${value}T12:00:00Z`); const start = new Date(`${weekStart}T12:00:00Z`); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  if (Number.isNaN(date.getTime()) || date < start || date > end) throw new AppError('MARKETING_DATE_OUTSIDE_WEEK', 'A data do Story precisa pertencer à semana selecionada.', { status: 422 });
}
function findStory(week, id) { const story = week.stories.find((item) => item.id === id); if (!story) throw new AppError('MARKETING_STORY_NOT_FOUND', 'O Story solicitado não foi encontrado.', { status: 404 }); return story; }
function sortStories(stories) { return [...stories].sort((a, b) => `${a.scheduledDate} ${a.scheduledTime} ${String(a.order).padStart(3, '0')}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime} ${String(b.order).padStart(3, '0')}`)); }
function touchDraft(week, now) { return { ...week, status: 'draft', approvedAt: null, closedAt: null, updatedAt: now().toISOString() }; }
function assertWeekMutable(week) { if (week.status === 'closed') throw new AppError('MARKETING_WEEK_CLOSED', 'Esta semana está encerrada e disponível somente para leitura.', { status: 409 }); }
function sourceCategory(result) { return result.templateCategory || DEFAULT_TEMPLATE_CATEGORY_ID; }
function categoryLabel(id) { const category = getTemplateCategoryById(id || DEFAULT_TEMPLATE_CATEGORY_ID); return category?.label || 'Sem categoria'; }
function createStoryRecord({ id, input, source, sourceFileName, timestamp }) { return { id, ...input, productKey: normalizeProductKey(input.productLabel), category: sourceCategory(source.result), categoryLabel: categoryLabel(source.result.templateCategory), sourceAssetFileName: sourceFileName, renderedAssetFileName: null, renderedDimensions: null, renderStatus: 'pending', editorialStatus: 'planned', publishedAt: null, renderedAt: null, renderError: null, createdAt: timestamp, updatedAt: timestamp }; }
function deterministicProposalOrder(items) {
  const tiers = [items.filter((item) => item.priority), items.filter((item) => !item.priority)];
  const output = [];
  for (const tier of tiers) {
    const remaining = [...tier].sort((a, b) => `${a.category}:${a.createdAt}:${a.sourceResultId}`.localeCompare(`${b.category}:${b.createdAt}:${b.sourceResultId}`));
    let lastCategory = output.at(-1)?.category; let lastProduct = output.at(-1)?.productLabel;
    while (remaining.length) {
      const idealIndex = remaining.findIndex((candidate) => candidate.category !== lastCategory && candidate.productLabel !== lastProduct);
      const categoryIndex = remaining.findIndex((candidate) => candidate.category !== lastCategory);
      const productIndex = remaining.findIndex((candidate) => candidate.productLabel !== lastProduct);
      const selectedIndex = idealIndex >= 0 ? idealIndex : categoryIndex >= 0 ? categoryIndex : productIndex >= 0 ? productIndex : 0;
      const [selected] = remaining.splice(selectedIndex, 1); output.push(selected); lastCategory = selected.category; lastProduct = selected.productLabel;
    }
  }
  return output;
}
function addUtcDays(value, amount) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function normalizeProductKey(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'produto'; }
function text(value, label, max, required = false) { const result = String(value || '').trim(); if (required && !result) throw new AppError('MARKETING_FIELD_REQUIRED', `${label} é obrigatório.`, { status: 400 }); if (result.length > max) throw new AppError('MARKETING_FIELD_TOO_LONG', `${label} deve ter no máximo ${max} caracteres.`, { status: 400 }); return result || null; }
function mimeFromFileName(fileName) { if (/\.png$/i.test(fileName)) return 'image/png'; if (/\.webp$/i.test(fileName)) return 'image/webp'; return 'image/jpeg'; }
function safeRenderError(error) { return { code: error?.code || 'STORY_RENDER_FAILED', message: error?.message || 'Não foi possível renderizar o Story.' }; }
