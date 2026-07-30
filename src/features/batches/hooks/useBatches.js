import { useCallback, useEffect, useRef, useState } from 'react';
import { batchAction, createBatch, fetchBatch, fetchBatches } from '../api/batchesClient.js';

const SELECTED_BATCH_STORAGE_KEY = 'prime-studio:selected-batch-id';
const TERMINAL_BATCH_STATUSES = new Set(['completed', 'completed_with_errors', 'cancelled']);

function readSelectedBatchId() {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(SELECTED_BATCH_STORAGE_KEY); }
  catch { return null; }
}
function saveSelectedBatchId(id) {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(SELECTED_BATCH_STORAGE_KEY, id); }
  catch { /* A seleção visual é opcional; o estado real continua no backend. */ }
}
function clearSelectedBatchId() {
  try { if (typeof window !== 'undefined') window.localStorage.removeItem(SELECTED_BATCH_STORAGE_KEY); }
  catch { /* A seleção visual é opcional; o estado real continua no backend. */ }
}

export default function useBatches(enabled) {
  const [batches, setBatches] = useState([]); const [selected, setSelected] = useState(null); const [status, setStatus] = useState('idle'); const [error, setError] = useState('');
  const selectedIdRef = useRef(null);
  const refreshVersionRef = useRef(0);
  const refresh = useCallback(async (id) => {
    if (id) selectedIdRef.current = id;
    const requestVersion = ++refreshVersionRef.current;
    setStatus('loading');
    try {
      const list = await fetchBatches();
      if (requestVersion !== refreshVersionRef.current) return;
      setBatches(list);
      const requestedId = id || selectedIdRef.current || readSelectedBatchId();
      const requestedExists = requestedId && list.some((batch) => batch.id === requestedId);
      if (requestedId && !requestedExists && requestedId === readSelectedBatchId()) {
        clearSelectedBatchId();
        if (selectedIdRef.current === requestedId) selectedIdRef.current = null;
      }
      const targetId = requestedExists ? requestedId : list.find((batch) => !TERMINAL_BATCH_STATUSES.has(batch.status))?.id;
      if (targetId) {
        selectedIdRef.current = targetId;
        const detail = await fetchBatch(targetId);
        if (requestVersion !== refreshVersionRef.current) return;
        setSelected(detail);
        saveSelectedBatchId(targetId);
      } else {
        selectedIdRef.current = null;
        setSelected(null);
      }
      setStatus('ready');
    } catch (e) {
      if (requestVersion !== refreshVersionRef.current) return;
      setError(e.message); setStatus('error');
    }
  }, []);
  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(() => refresh(), 2500);
    return () => {
      clearInterval(timer);
      refreshVersionRef.current += 1;
    };
  }, [enabled, refresh]);
  const submit = async (payload) => { const batch = await createBatch(payload); await refresh(batch.id); return batch; };
  const action = async (actionName, payload) => { if (!selected) return; await batchAction(selected.id, actionName, payload); await refresh(selected.id); };
  const select = useCallback((batch) => { selectedIdRef.current = batch.id; saveSelectedBatchId(batch.id); return refresh(batch.id); }, [refresh]);
  return { batches, selected, select, status, error, refresh, submit, action };
}
