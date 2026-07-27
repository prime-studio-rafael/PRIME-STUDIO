import { useCallback, useState } from 'react';
import { fetchAiProviders } from '../api/aiSettingsClient.js';

export default function useAiSettings() {
  const [providers, setProviders] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading'); setError('');
    try {
      const result = await fetchAiProviders();
      setProviders(result.providers || []); setStatus('ready');
      return result.providers || [];
    } catch (nextError) {
      setError(nextError.message); setStatus('error'); throw nextError;
    }
  }, []);

  const replaceProvider = useCallback((provider) => {
    setProviders((current) => current.map((item) => item.provider === provider.provider ? provider : item));
  }, []);

  return { providers, status, error, load, replaceProvider };
}
