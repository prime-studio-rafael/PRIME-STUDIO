import { createKeychainSecretStore, runSecurityCommand } from './keychainSecretStore.js';

export const DEEPSEEK_KEYCHAIN_SERVICE = 'PRIME_IA_STUDIO_DEEPSEEK';
export const DEEPSEEK_KEYCHAIN_ACCOUNT = 'local-user';

export function createDeepSeekKeyStore({ runSecurity = runSecurityCommand } = {}) {
  return createKeychainSecretStore({ service: DEEPSEEK_KEYCHAIN_SERVICE, account: DEEPSEEK_KEYCHAIN_ACCOUNT, runSecurity });
}
