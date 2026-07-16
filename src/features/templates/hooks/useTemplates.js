import { useCallback, useEffect, useState } from 'react';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  fetchTemplates,
  replaceTemplateImage,
  setTemplateActive,
  updateTemplate,
} from '../api/templatesClient.js';

export default function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [mutationPending, setMutationPending] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setTemplates(await fetchTemplates());
      setStatus('ready');
    } catch (nextError) {
      setError(nextError.message || 'Não foi possível carregar os templates locais.');
      setStatus('error');
      throw nextError;
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchTemplates()
      .then((nextTemplates) => {
        if (!active) return;
        setTemplates(nextTemplates);
        setStatus('ready');
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError.message || 'Não foi possível carregar os templates locais.');
        setStatus('error');
      });
    return () => { active = false; };
  }, []);

  const mutate = useCallback(async (operation) => {
    setMutationPending(true);
    setError('');
    try {
      const result = await operation();
      const nextTemplates = await fetchTemplates();
      setTemplates(nextTemplates);
      setStatus('ready');
      return result;
    } catch (nextError) {
      setError(nextError.message || 'Não foi possível alterar o template.');
      throw nextError;
    } finally {
      setMutationPending(false);
    }
  }, []);

  const actions = {
    create: useCallback((data) => mutate(() => createTemplate(data)), [mutate]),
    update: useCallback((id, data) => mutate(() => updateTemplate(id, data)), [mutate]),
    replaceImage: useCallback((id, file) => mutate(() => replaceTemplateImage(id, file)), [mutate]),
    duplicate: useCallback((id) => mutate(() => duplicateTemplate(id)), [mutate]),
    setActive: useCallback((id, active) => mutate(() => setTemplateActive(id, active)), [mutate]),
    remove: useCallback((id) => mutate(() => deleteTemplate(id)), [mutate]),
  };

  return { templates, status, error, mutationPending, load, ...actions };
}
