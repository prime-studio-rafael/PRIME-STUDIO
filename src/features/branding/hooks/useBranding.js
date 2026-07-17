import { useCallback, useEffect, useState } from 'react';
import { approveBrandingLogo, deleteBrandingLogo, fetchBrandingState, updateBrandingConfig, uploadBrandingLogo } from '../api/brandingClient.js';

export default function useBranding(enabled) {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [mutationPending, setMutationPending] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading'); setError('');
    try { setState(await fetchBrandingState()); setStatus('ready'); }
    catch (nextError) { setError(nextError.message || 'Não foi possível carregar a configuração de branding.'); setStatus('error'); }
  }, []);

  useEffect(() => { if (enabled && status === 'idle') load().catch(() => {}); }, [enabled, load, status]);

  const upload = useCallback(async (file) => {
    setMutationPending(true); setError('');
    try { await uploadBrandingLogo(file); await load(); }
    catch (nextError) { setError(nextError.message); throw nextError; }
    finally { setMutationPending(false); }
  }, [load]);

  const approve = useCallback(async () => {
    setMutationPending(true); setError('');
    try { await approveBrandingLogo(); await load(); }
    catch (nextError) { setError(nextError.message); throw nextError; }
    finally { setMutationPending(false); }
  }, [load]);

  const setEnabled = useCallback(async (value) => {
    setMutationPending(true); setError('');
    try { await updateBrandingConfig(value); await load(); }
    catch (nextError) { setError(nextError.message); throw nextError; }
    finally { setMutationPending(false); }
  }, [load]);

  const remove = useCallback(async () => {
    setMutationPending(true); setError('');
    try { await deleteBrandingLogo(); await load(); }
    catch (nextError) { setError(nextError.message); throw nextError; }
    finally { setMutationPending(false); }
  }, [load]);

  return { state, status, error, mutationPending, load, upload, approve, setEnabled, remove };
}
