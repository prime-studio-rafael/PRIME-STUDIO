import { describe, expect, it } from 'vitest';
import { appendBatchEvent, createBatchEvent, normalizeBatchEvents, sanitizeBatchEventData } from '../../server/utils/batchEvents.js';

const at = '2026-07-30T12:00:00.000Z';
const options = { createId: (() => { let value = 0; return () => `00000000-0000-4000-8000-0000000000${++value}`; })(), now: () => new Date(at) };

describe('batch events', () => {
  it('creates a compact valid event with a nullable item id', () => {
    expect(createBatchEvent({ type: 'batch_created', at, itemId: null, data: { count: 2 } }, options)).toMatchObject({ at, type: 'batch_created', itemId: null, fromStatus: null, toStatus: null, data: { count: 2 } });
  });

  it('accepts only canonical ISO UTC timestamps with milliseconds', () => {
    expect(createBatchEvent({ type: 'batch_created', at: '2026-07-30T20:09:15.123Z' }, options)).toMatchObject({ at: '2026-07-30T20:09:15.123Z' });
    expect(() => createBatchEvent({ type: 'unknown', at }, options)).toThrow('type is invalid');
    for (const invalidAt of [
      'not-a-date', '07/30/2026', 'July 30, 2026', '2026-07-30', '2026-07-30T20:09:15',
      '2026-07-30T20:09:15Z', '2026-07-30T20:09:15.12Z', '2026-07-30T20:09:15.123+00:00',
      '2026-02-30T10:00:00.000Z', '', null, undefined,
    ]) expect(() => createBatchEvent({ type: 'batch_created', at: invalidAt }, options)).toThrow('timestamp is invalid');
  });

  it('keeps only explicitly allowed compact data fields', () => {
    expect(sanitizeBatchEventData({ resultId: 'result-1', durationMs: 0, costUsd: 0.034, providerRequestId: 'request-1', prompt: 'não persistir', path: '/Users/macbook', base64: 'abc', message: 'erro técnico longo' })).toEqual({ resultId: 'result-1', durationMs: 0, costUsd: 0.034, providerRequestId: 'request-1' });
  });

  it('normalizes legacy batches and removes malformed or duplicate events', () => {
    const event = { id: 'event-1', at, type: 'batch_created', itemId: null, fromStatus: null, toStatus: null, data: { count: 1 } };
    expect(normalizeBatchEvents(undefined)).toEqual([]);
    expect(normalizeBatchEvents([event, event, { id: 'broken', at: 'invalid', type: 'batch_created' }, { id: 'missing-at', type: 'batch_created' }])).toEqual([event]);
  });

  it('does not duplicate idempotent diagnostic events and enforces event ids unique within a batch', () => {
    const batch = { events: [] };
    appendBatchEvent(batch, { id: 'event-1', type: 'recovery_ignored_invalid_asset', at, itemId: 'item-1', data: { reason: 'asset_invalid', resultId: 'result-1' } });
    appendBatchEvent(batch, { id: 'event-2', type: 'recovery_ignored_invalid_asset', at, itemId: 'item-1', data: { reason: 'asset_invalid', resultId: 'result-1' } });
    expect(batch.events).toHaveLength(1);
    expect(() => appendBatchEvent(batch, { id: 'event-1', type: 'batch_started', at })).toThrow('unique');
  });
});
