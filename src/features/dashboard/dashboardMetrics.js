import { DEFAULT_STORY_LAYOUT_ID, normalizeStoryLayoutId, STORY_LOGO_SIZES } from '../../../shared/storyLayoutSpec.js';
import { resolveStoryVisualStyle, STORY_LOGO_MODES } from '../../../shared/storyVisualStyleSpec.js';
import { STORY_DEFAULT_TYPOGRAPHY, STORY_TYPOGRAPHY_PRESETS } from '../../../shared/storyTypographySpec.js';

export const PERIOD_DAYS = Object.freeze({ Hoje: 1, '7 dias': 7, '30 dias': 30 });
const ACTIVE_BATCH_STATUSES = new Set(['ready', 'running', 'paused', 'interrupted']);
const COMPLETED_BATCH_STATUSES = new Set(['completed', 'completed_with_errors']);
const TERMINAL_ITEM_STATUSES = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const TIMEZONE = 'America/Sao_Paulo';

export function uniqueResults(results = []) {
  const seen = new Set();
  return results.filter((result, index) => {
    const key = result?.id ? `id:${result.id}` : `index:${index}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function timestamp(value) { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : null; }
export function normalizeModel(model) { return typeof model === 'string' ? model.trim().replace(/\s+/g, ' ') : ''; }
export function presentModelLabel(model) {
  const normalized = normalizeModel(model);
  if (!normalized || !normalized.includes('/')) return normalized || 'Não informado';
  return normalized.split('/').at(-1).split(/[-_]+/).filter((part) => part && part !== 'image').map((part) => /^\d/.test(part) ? part : `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}

function dateKey(value) {
  const parsed = timestamp(value); if (parsed === null) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parsed);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
function keyFromUtcDate(date) { return date.toISOString().slice(0, 10); }
function periodKeys(period, now) {
  const today = dateKey(now) || keyFromUtcDate(now);
  const [year, month, day] = today.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const keys = [];
  for (let index = (PERIOD_DAYS[period] || 1) - 1; index >= 0; index -= 1) {
    const value = new Date(cursor); value.setUTCDate(cursor.getUTCDate() - index); keys.push(keyFromUtcDate(value));
  }
  return keys;
}
function inPeriod(result, period, now) { return periodKeys(period, now).includes(dateKey(result?.createdAt)); }
function formatDayLabel(key, period) {
  const date = new Date(`${key}T12:00:00.000Z`);
  return period === 'Hoje' ? 'Hoje' : new Intl.DateTimeFormat('pt-BR', { timeZone: TIMEZONE, weekday: 'short' }).format(date).replace('.', '');
}
function resultStatus(result) { if (result.reviewStatus === 'approved') return { label: 'Aprovada', tone: 'emerald' }; if (result.reviewStatus === 'rejected') return { label: 'Reprovada', tone: 'rose' }; if (result.reviewStatus === 'pending') return { label: 'Em revisão', tone: 'amber' }; return { label: 'Estado não informado', tone: 'slate' }; }
function relativeTime(value, now) { const parsed = timestamp(value); if (parsed === null) return 'Data não informada'; const minutes = Math.max(0, Math.round((now.getTime() - parsed) / 60_000)); if (minutes < 1) return 'agora'; if (minutes < 60) return `há ${minutes} min`; const hours = Math.round(minutes / 60); return hours < 24 ? `há ${hours} h` : `há ${Math.round(hours / 24)} d`; }
function absoluteDate(value) { const parsed = timestamp(value); return parsed === null ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed); }

export function getProductionSeries({ results = [], period = 'Hoje', now = new Date() } = {}) {
  const keys = periodKeys(period, now); const counts = new Map(keys.map((key) => [key, 0]));
  uniqueResults(results).forEach((result) => { const key = dateKey(result?.createdAt); if (key && counts.has(key)) counts.set(key, counts.get(key) + 1); });
  const points = keys.map((key) => ({ key, label: formatDayLabel(key, period), value: counts.get(key) }));
  return { points, hasData: points.some((point) => point.value > 0) };
}

export function getModelDistribution({ results = [], period = 'Hoje', now = new Date() } = {}) {
  const buckets = new Map();
  uniqueResults(results).filter((result) => inPeriod(result, period, now)).forEach((result) => {
    const raw = normalizeModel(result.model); const key = raw ? raw.toLocaleLowerCase('pt-BR') : '__unknown__';
    const current = buckets.get(key) || { technical: raw || null, label: presentModelLabel(raw), count: 0 };
    buckets.set(key, { ...current, count: current.count + 1 });
  });
  const total = [...buckets.values()].reduce((sum, item) => sum + item.count, 0);
  return { total, items: [...buckets.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR')).map((item) => ({ ...item, percentage: total ? Math.round((item.count / total) * 100) : 0 })) };
}

export function getApprovalRate({ results = [], period = 'Hoje', now = new Date() } = {}) {
  const completed = uniqueResults(results).filter((result) => inPeriod(result, period, now) && ['approved', 'rejected'].includes(result.reviewStatus));
  const approved = completed.filter((result) => result.reviewStatus === 'approved').length;
  return { approved, completed: completed.length, percentage: completed.length ? (approved / completed.length) * 100 : null };
}

export function getMarketingDistributions(weeks = []) {
  const stories = weeks.flatMap((week) => Array.isArray(week?.stories) ? week.stories : []);
  const styles = new Map(); const typography = new Map();
  stories.forEach((story) => {
    const layout = normalizeStoryLayoutId(story.storyTemplateId || DEFAULT_STORY_LAYOUT_ID) || DEFAULT_STORY_LAYOUT_ID;
    const typographyPreset = story.typographyPreset === undefined || story.typographyPreset === null || story.typographyPreset === '' ? STORY_DEFAULT_TYPOGRAPHY : story.typographyPreset;
    const typographyValid = Boolean(STORY_TYPOGRAPHY_PRESETS[typographyPreset]);
    const logoMode = STORY_LOGO_MODES.includes(story.logoMode) ? story.logoMode : 'auto';
    const logoSize = STORY_LOGO_SIZES[story.logoSize] ? story.logoSize : 'medium';
    const style = typographyValid ? resolveStoryVisualStyle({ storyTemplateId: layout, typographyPreset, logoMode, logoSize }) : null;
    increment(styles, style?.label || 'Personalizado');
    increment(typography, typographyValid ? STORY_TYPOGRAPHY_PRESETS[typographyPreset].label : 'Não informado');
  });
  return { storyCount: stories.length, styles: distribution(styles), typography: distribution(typography) };
}
function increment(map, label) { map.set(label, (map.get(label) || 0) + 1); }
function distribution(map) { const total = [...map.values()].reduce((sum, value) => sum + value, 0); return { total, items: [...map.entries()].map(([label, count]) => ({ label, count, percentage: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR')) }; }

export function getDashboardMetrics({ results = [], batches = [], period = 'Hoje', now = new Date() } = {}) {
  const unique = uniqueResults(results); const periodResults = unique.filter((result) => inPeriod(result, period, now));
  const withDuration = periodResults.filter((result) => Number.isFinite(result.durationMs) && result.durationMs > 0); const costResults = periodResults.filter((result) => Number.isFinite(result.costUsd) && result.costUsd >= 0);
  const models = getModelDistribution({ results, period, now }); const activeBatches = batches.filter((batch) => ACTIVE_BATCH_STATUSES.has(batch.status));
  const previousNow = new Date(now); previousNow.setUTCDate(previousNow.getUTCDate() - 1);
  return { periodResults, generatedCount: periodResults.length, averageDurationMs: withDuration.length ? withDuration.reduce((sum, result) => sum + result.durationMs, 0) / withDuration.length : null, costUsd: costResults.length ? costResults.reduce((sum, result) => sum + result.costUsd, 0) : null, costSampleCount: costResults.length, mainModel: models.items[0]?.technical || null, activeBatches, completedBatches: batches.filter((batch) => COMPLETED_BATCH_STATUSES.has(batch.status)), queueItems: activeBatches.reduce((count, batch) => count + (batch.items || []).filter((item) => !TERMINAL_ITEM_STATUSES.has(item.status)).length, 0), recent: [...unique].sort((a, b) => (timestamp(b.createdAt) || 0) - (timestamp(a.createdAt) || 0)).slice(0, 4).map((result) => ({ name: result.templateLabel || result.id || 'Produção sem identificação', time: relativeTime(result.createdAt, now), absoluteTime: absoluteDate(result.createdAt), ...resultStatus(result) })), todayCount: unique.filter((result) => inPeriod(result, 'Hoje', now)).length, yesterdayCount: unique.filter((result) => inPeriod(result, 'Hoje', previousNow)).length, pendingResults: periodResults.filter((result) => result.reviewStatus === 'pending').length, readyResults: periodResults.filter((result) => result.reviewStatus === 'approved').length };
}
export function getInsights(metrics) { const insights = []; if (metrics.todayCount > metrics.yesterdayCount) insights.push(`Hoje você produziu ${metrics.todayCount - metrics.yesterdayCount} imagem(ns) a mais que ontem.`); else if (metrics.todayCount) insights.push(`Hoje você produziu ${metrics.todayCount} imagem(ns).`); if (metrics.activeBatches.length) insights.push(`${metrics.activeBatches.length} lote(s) seguem ativos, com ${metrics.queueItems} item(ns) pendente(s).`); if (metrics.readyResults) insights.push(`${metrics.readyResults} resultado(s) aprovado(s) no período selecionado.`); return insights.length ? insights.slice(0, 3) : ['Ainda não há dados locais suficientes para gerar insights operacionais.']; }
