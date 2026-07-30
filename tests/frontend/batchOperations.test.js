import { describe, expect, it } from 'vitest';
import { formatApproximateDuration, getBatchEta, getBatchOperationalSummary, getCurrentBatchItem } from '../../src/features/batches/batchOperations.js';

const completed = (durationMs) => ({ status: 'completed', durationMs });

describe('batch operational metrics', () => {
  it('counts every persisted item state once', () => {
    expect(getBatchOperationalSummary([
      { status: 'queued' }, { status: 'preparing' }, { status: 'generating' }, { status: 'completed' },
      { status: 'failed' }, { status: 'cancelled' }, { status: 'interrupted' },
    ])).toEqual({ total: 7, completed: 1, processing: 2, pending: 1, failed: 1, cancelled: 1, interrupted: 1 });
  });

  it('calculates ETA only from valid completed durations and remaining eligible items', () => {
    const eta = getBatchEta([
      completed(10_000), completed(20_000), { status: 'failed', durationMs: 1_000 }, { status: 'queued' }, { status: 'generating' }, { status: 'cancelled' },
    ], 'running');
    expect(eta).toMatchObject({ state: 'available', remainingItems: 2, averageDurationMs: 15_000, etaMs: 30_000 });
  });

  it('uses honest special ETA states without inventing a duration', () => {
    expect(getBatchEta([{ status: 'queued' }], 'running').state).toBe('awaiting-sample');
    expect(getBatchEta([completed(10_000), { status: 'queued' }], 'paused').state).toBe('paused');
    ['cancelled', 'completed', 'completed_with_errors', 'interrupted'].forEach((status) => {
      expect(getBatchEta([completed(10_000), { status: 'queued' }], status).state).toBe('unavailable');
    });
  });

  it('formats approximate durations in seconds, minutes and hours', () => {
    expect(formatApproximateDuration(10_000)).toBe('menos de 1 min');
    expect(formatApproximateDuration(45_000)).toBe('45 s');
    expect(formatApproximateDuration(90_000)).toBe('2 min');
    expect(formatApproximateDuration(3_660_000)).toBe('1 h 1 min');
  });

  it('identifies the active item and its position within the batch', () => {
    const current = getCurrentBatchItem([{ status: 'completed' }, { status: 'generating', originalFileName: 'camiseta.png', startedAt: '2026-07-30T12:00:00.000Z' }], Date.parse('2026-07-30T12:00:45.000Z'));
    expect(current).toMatchObject({ state: 'single', position: 2, elapsedMs: 45_000 });
    expect(current.item.originalFileName).toBe('camiseta.png');
  });

  it('does not hide an inconsistent state with multiple active items', () => {
    expect(getCurrentBatchItem([{ status: 'preparing' }, { status: 'generating' }])).toMatchObject({ state: 'multiple' });
    expect(getCurrentBatchItem([{ status: 'queued' }]).state).toBe('none');
  });
});
