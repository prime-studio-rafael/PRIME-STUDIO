import { useEffect, useState } from 'react';
import { fetchBrandingState } from '../../branding/api/brandingClient.js';
import { fetchMarketingWeeks } from '../../marketing/api/marketingClient.js';
import { fetchAiProviders } from '../../settings/api/aiSettingsClient.js';
import { fetchLocalHealth } from '../api/dashboardOperationsClient.js';

const idle = { status: 'idle', data: null, error: '' };

export default function useDashboardOperations(enabled) {
  const [state, setState] = useState({ weeks: idle, branding: idle, providers: idle, health: idle });
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = async (key, read) => {
      try { const data = await read(); if (active) setState((current) => ({ ...current, [key]: { status: 'ready', data, error: '' } })); }
      catch (error) { if (active) setState((current) => ({ ...current, [key]: { status: 'error', data: null, error: error?.message || 'Falha local.' } })); }
    };
    setState({ weeks: { ...idle, status: 'loading' }, branding: { ...idle, status: 'loading' }, providers: { ...idle, status: 'loading' }, health: { ...idle, status: 'loading' } });
    load('weeks', fetchMarketingWeeks); load('branding', fetchBrandingState); load('providers', fetchAiProviders); load('health', fetchLocalHealth);
    return () => { active = false; };
  }, [enabled]);
  return { ...state, weeks: state.weeks.data?.weeks || [] };
}
