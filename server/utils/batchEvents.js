import { randomUUID } from 'node:crypto';

export const BATCH_EVENT_TYPES = Object.freeze([
  'batch_created', 'batch_started', 'batch_resumed', 'pause_requested', 'batch_paused', 'batch_interrupted', 'cancel_requested', 'batch_cancelled', 'batch_completed',
  'item_preparing', 'item_requeued', 'item_generation_started', 'item_completed', 'item_failed', 'item_cancelled', 'item_interrupted', 'item_result_recovered',
  'recovery_ignored_invalid_metadata', 'recovery_ignored_invalid_asset', 'recovery_ignored_conflict', 'recovery_ignored_incorrect_association',
]);

const EVENT_TYPES = new Set(BATCH_EVENT_TYPES);
const SAFE_ID = /^[a-zA-Z0-9-]+$/;
const SAFE_STATUS = new Set(['ready', 'running', 'paused', 'interrupted', 'cancelled', 'completed', 'completed_with_errors', 'queued', 'preparing', 'generating', 'failed']);
const SAFE_DATA_KEYS = new Set(['resultId', 'providerRequestId', 'costUsd', 'durationMs', 'errorCode', 'reason', 'count']);
const MAX_TEXT_LENGTH = 160;
const MAX_EVENTS_PER_BATCH = 2_000;
const ISO_UTC_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function createBatchEvent(input, { createId = randomUUID, now = () => new Date() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Batch event input must be an object.');
  if (!EVENT_TYPES.has(input.type)) throw new TypeError('Batch event type is invalid.');
  const at = Object.hasOwn(input, 'at') ? input.at : now().toISOString();
  if (!validTimestamp(at)) throw new TypeError('Batch event timestamp is invalid.');
  const id = input.id ?? createId();
  if (!SAFE_ID.test(String(id))) throw new TypeError('Batch event id is invalid.');
  const itemId = input.itemId ?? null;
  if (itemId !== null && !SAFE_ID.test(String(itemId))) throw new TypeError('Batch event item id is invalid.');
  const fromStatus = normalizeStatus(input.fromStatus);
  const toStatus = normalizeStatus(input.toStatus);
  return Object.freeze({ id: String(id), at, type: input.type, itemId: itemId === null ? null : String(itemId), fromStatus, toStatus, data: sanitizeBatchEventData(input.data) });
}

export function normalizeBatchEvents(events) {
  if (!Array.isArray(events)) return [];
  const ids = new Set();
  const normalized = [];
  for (const value of events) {
    try {
      if (!Object.hasOwn(value || {}, 'at')) continue;
      const event = createBatchEvent(value);
      if (ids.has(event.id)) continue;
      ids.add(event.id);
      normalized.push(event);
    } catch {
      // Eventos antigos ou corrompidos não podem quebrar a leitura do lote.
    }
  }
  return normalized.slice(-MAX_EVENTS_PER_BATCH);
}

export function appendBatchEvent(batch, input, options) {
  if (!batch || typeof batch !== 'object') throw new TypeError('Batch is required to append an event.');
  const events = normalizeBatchEvents(batch.events);
  const ids = new Set(events.map((event) => event.id));
  let event = createBatchEvent(input, options);
  if (ids.has(event.id) && input?.id) throw new TypeError('Batch event id must be unique within the batch.');
  for (let attempt = 0; ids.has(event.id) && attempt < 8; attempt += 1) event = createBatchEvent({ ...input, id: undefined }, options);
  if (ids.has(event.id)) throw new TypeError('Unable to create a unique batch event id.');
  if (events.some((current) => sameDiagnosticEvent(current, event))) {
    batch.events = events;
    return null;
  }
  batch.events = [...events, event].slice(-MAX_EVENTS_PER_BATCH);
  return event;
}

export function sanitizeBatchEventData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const safe = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SAFE_DATA_KEYS.has(key)) continue;
    if ((key === 'resultId' || key === 'providerRequestId') && typeof value === 'string' && value.length <= MAX_TEXT_LENGTH) safe[key] = value;
    if ((key === 'costUsd' || key === 'durationMs') && typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = value;
    if ((key === 'errorCode' || key === 'reason') && typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) && value.length <= MAX_TEXT_LENGTH) safe[key] = value;
    if (key === 'count' && Number.isSafeInteger(value) && value >= 0) safe[key] = value;
  }
  return safe;
}

function normalizeStatus(value) {
  if (value == null) return null;
  if (!SAFE_STATUS.has(value)) throw new TypeError('Batch event status is invalid.');
  return value;
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !ISO_UTC_MILLISECONDS.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function sameDiagnosticEvent(current, event) {
  if (!event.type.startsWith('recovery_ignored_')) return false;
  return current.type === event.type
    && current.itemId === event.itemId
    && current.data.reason === event.data.reason
    && current.data.resultId === event.data.resultId;
}
