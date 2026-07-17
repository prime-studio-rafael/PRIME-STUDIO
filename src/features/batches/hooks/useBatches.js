import { useCallback, useEffect, useState } from 'react';
import { batchAction, createBatch, fetchBatch, fetchBatches } from '../api/batchesClient.js';
export default function useBatches(enabled) {
  const [batches, setBatches] = useState([]); const [selected, setSelected] = useState(null); const [status, setStatus] = useState('idle'); const [error, setError] = useState('');
  const refresh = useCallback(async (id) => { setStatus('loading'); try { const list = await fetchBatches(); setBatches(list); const target = id || selected?.id; if (target) setSelected(await fetchBatch(target)); setStatus('ready'); } catch (e) { setError(e.message); setStatus('error'); } }, [selected?.id]);
  useEffect(() => { if (!enabled) return undefined; refresh(); const timer = setInterval(() => refresh(), 2500); return () => clearInterval(timer); }, [enabled, refresh]);
  const submit = async (payload) => { const batch = await createBatch(payload); await refresh(batch.id); return batch; };
  const action = async (actionName, payload) => { if (!selected) return; await batchAction(selected.id, actionName, payload); await refresh(selected.id); };
  return { batches, selected, select: (batch) => refresh(batch.id), status, error, refresh, submit, action };
}
