import { createKeychainSecretStore, runSecurityCommand } from './keychainSecretStore.js';

export const KEYCHAIN_SERVICE = 'PRIME_IA_STUDIO_OPENROUTER';
export const KEYCHAIN_ACCOUNT = 'local-user';

export function createOpenRouterKeyStore({ runSecurity = runSecurityCommand } = {}) {
  return createKeychainSecretStore({ service: KEYCHAIN_SERVICE, account: KEYCHAIN_ACCOUNT, runSecurity });
}
