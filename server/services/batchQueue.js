import { generationConfig } from '../config/generationConfig.js';
/** Sequential, in-process runner. Persistent state lives in LocalBatchRepository. */
export function createBatchQueue({ batchService, executor, coordinator, logger = console } = {}) {
  const active = new Set();
  async function enqueue(batchId) { if (active.has(batchId)) return; active.add(batchId); queueMicrotask(() => process(batchId)); }
  async function process(batchId) {
    try {
      while (true) {
        const prepared = await batchService.prepareNext(batchId); if (!prepared) break;
        const itemId = prepared.item.id; let started = false;
        try {
          const result = await coordinator.run(async () => {
            started = await batchService.beginPrepared(batchId, itemId); if (!started) return null;
            const input = await batchService.executionInput(batchId, itemId);
            return executor.execute({ ...input, modelId: generationConfig.modelId, batchContext: { batchId, batchItemId: itemId } });
          }, { wait: true });
          if (started && result) await batchService.complete(batchId, itemId, result);
        } catch (error) { if (started) await batchService.fail(batchId, itemId, error); else logger.error?.('[batch]', error?.code || error?.message); }
      }
    } finally { active.delete(batchId); }
  }
  const api = Object.freeze({ enqueue, isProcessing: (id) => active.has(id) }); batchService.setQueue(api); return api;
}
