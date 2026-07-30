const ACTIVE_STATUSES = new Set(['preparing', 'generating']);
const REMAINING_STATUSES = new Set(['queued', 'preparing', 'generating']);

export function getBatchOperationalSummary(items = []) {
  const normalized = Array.isArray(items) ? items : [];
  const byStatus = (status) => normalized.filter((item) => item.status === status).length;
  const processing = normalized.filter((item) => ACTIVE_STATUSES.has(item.status)).length;

  return {
    total: normalized.length,
    completed: byStatus('completed'),
    processing,
    pending: byStatus('queued'),
    failed: byStatus('failed'),
    cancelled: byStatus('cancelled'),
    interrupted: byStatus('interrupted'),
  };
}

export function getBatchEta(items = [], batchStatus) {
  if (batchStatus === 'paused') return { state: 'paused', remainingItems: 0, averageDurationMs: null, etaMs: null };
  if (['cancelled', 'completed', 'completed_with_errors', 'interrupted'].includes(batchStatus)) {
    return { state: 'unavailable', remainingItems: 0, averageDurationMs: null, etaMs: null };
  }

  const normalized = Array.isArray(items) ? items : [];
  const durations = normalized
    .filter((item) => item.status === 'completed' && Number.isFinite(item.durationMs) && item.durationMs > 0)
    .map((item) => item.durationMs);
  const remainingItems = normalized.filter((item) => REMAINING_STATUSES.has(item.status)).length;

  if (!durations.length) return { state: 'awaiting-sample', remainingItems, averageDurationMs: null, etaMs: null };
  if (!remainingItems) return { state: 'unavailable', remainingItems: 0, averageDurationMs: null, etaMs: null };

  const averageDurationMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  return { state: 'available', remainingItems, averageDurationMs, etaMs: averageDurationMs * remainingItems };
}

export function formatApproximateDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  if (seconds < 60) return seconds < 15 ? 'menos de 1 min' : `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

export function getCurrentBatchItem(items = [], now = Date.now()) {
  const normalized = Array.isArray(items) ? items : [];
  const active = normalized
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => ACTIVE_STATUSES.has(item.status));

  if (!active.length) return { state: 'none', activeItems: [] };
  if (active.length > 1) return { state: 'multiple', activeItems: active };

  const [{ item, index }] = active;
  const startedAt = Date.parse(item.startedAt);
  const elapsedMs = Number.isFinite(startedAt) && startedAt <= now ? now - startedAt : null;
  return { state: 'single', item, position: index + 1, elapsedMs, activeItems: active };
}
