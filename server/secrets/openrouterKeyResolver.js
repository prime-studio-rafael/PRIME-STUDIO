import { readEnv } from '../config/env.js';
import { createOpenRouterKeyStore } from './openrouterKeyStore.js';

export function createOpenRouterKeyResolver({
  keyStore = createOpenRouterKeyStore(),
  getEnvKey = () => readEnv().apiKey,
} = {}) {
  async function resolve() {
    const keychainKey = await keyStore.getKey();
    if (keychainKey) return { apiKey: keychainKey, source: 'keychain' };

    const envKey = String(getEnvKey() || '').trim();
    if (envKey) return { apiKey: envKey, source: 'env' };

    return { apiKey: null, source: 'none' };
  }

  return {
    resolve,
    async getOpenRouterApiKey() {
      return (await resolve()).apiKey;
    },
    async getStatus() {
      const { apiKey, source } = await resolve();
      return { configured: Boolean(apiKey), source };
    },
  };
}
