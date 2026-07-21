import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/marketingClient.js';

export default function useMarketing(enabled) {
  const [layouts, setLayouts] = useState([]);
  const [sources, setSources] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading'); setError('');
    try {
      const [nextLayouts, nextSources, nextWeeks] = await api.fetchMarketingBootstrap();
      setLayouts(nextLayouts); setSources(nextSources); setWeeks(nextWeeks);
      setSelected((current) => nextWeeks.find((week) => week.id === current?.id) || nextWeeks[0] || null);
      setStatus('ready');
    } catch (nextError) { setError(nextError.message); setStatus('error'); throw nextError; }
  }, []);

  useEffect(() => { if (enabled) load().catch(() => {}); }, [enabled, load]);

  const mutate = useCallback(async (operation) => {
    setBusy(true); setError('');
    try {
      const value = await operation();
      if (value?.stories) {
        setSelected(value);
        setWeeks((current) => current.some((week) => week.id === value.id) ? current.map((week) => week.id === value.id ? value : week) : [value, ...current]);
      }
      return value;
    } catch (nextError) { setError(nextError.message); throw nextError; }
    finally { setBusy(false); }
  }, []);

  const select = useCallback(async (id) => mutate(async () => api.fetchMarketingWeek(id)), [mutate]);
  const createWeek = useCallback((weekStart) => mutate(() => api.createMarketingWeek(weekStart)), [mutate]);
  const updateWeek = useCallback((changes) => mutate(() => api.updateMarketingWeek(selected.id, changes)), [mutate, selected]);
  const approveWeek = useCallback(() => mutate(() => api.approveMarketingWeek(selected.id)), [mutate, selected]);
  const draftWeek = useCallback(() => mutate(() => api.draftMarketingWeek(selected.id)), [mutate, selected]);
  const closeWeek = useCallback(() => mutate(() => api.closeMarketingWeek(selected.id)), [mutate, selected]);
  const proposeWeek = useCallback((items) => mutate(() => api.proposeMarketingWeek(selected.id, items)), [mutate, selected]);
  const removeWeek = useCallback(() => mutate(async () => { await api.deleteMarketingWeek(selected.id); const remaining = weeks.filter((week) => week.id !== selected.id); setWeeks(remaining); setSelected(remaining[0] || null); }), [mutate, selected, weeks]);
  const addStory = useCallback((story) => mutate(() => api.createMarketingStory(selected.id, story)), [mutate, selected]);
  const updateStory = useCallback((id, story) => mutate(() => api.updateMarketingStory(selected.id, id, story)), [mutate, selected]);
  const removeStory = useCallback((id) => mutate(() => api.deleteMarketingStory(selected.id, id)), [mutate, selected]);
  const renderStory = useCallback((id) => mutate(() => api.renderMarketingStory(selected.id, id)), [mutate, selected]);
  const setEditorialStatus = useCallback((id, editorialStatus) => mutate(() => api.updateMarketingEditorialStatus(selected.id, id, editorialStatus)), [mutate, selected]);

  return { layouts, sources, weeks, selected, status, error, busy, load, select, createWeek, updateWeek, approveWeek, draftWeek, closeWeek, proposeWeek, removeWeek, addStory, updateStory, removeStory, renderStory, setEditorialStatus };
}
