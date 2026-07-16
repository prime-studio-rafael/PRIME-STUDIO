import { spawn } from 'node:child_process';
import { AppError } from '../utils/errors.js';

export const KEYCHAIN_SERVICE = 'PRIME_IA_STUDIO_OPENROUTER';
export const KEYCHAIN_ACCOUNT = 'local-user';
const SECURITY_TIMEOUT_MS = 10_000;

export function createOpenRouterKeyStore({ runSecurity = runSecurityCommand } = {}) {
  return {
    async saveKey(apiKey) {
      const args = [
        'add-generic-password',
        '-a', KEYCHAIN_ACCOUNT,
        '-s', KEYCHAIN_SERVICE,
        '-U',
        '-w', apiKey,
      ];
      try {
        await runSecurity(args);
      } finally {
        args[args.length - 1] = '';
        apiKey = '';
      }
    },

    async hasKey() {
      try {
        await runSecurity(['find-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE]);
        return true;
      } catch (error) {
        if (error?.code === 'KEYCHAIN_KEY_NOT_FOUND') return false;
        throw error;
      }
    },

    async getKey() {
      try {
        const value = await runSecurity([
          'find-generic-password',
          '-a', KEYCHAIN_ACCOUNT,
          '-s', KEYCHAIN_SERVICE,
          '-w',
        ], { captureStdout: true });
        return String(value || '').trim() || null;
      } catch (error) {
        if (error?.code === 'KEYCHAIN_KEY_NOT_FOUND') return null;
        throw error;
      }
    },

    async deleteKey() {
      try {
        await runSecurity(['delete-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE]);
        return true;
      } catch (error) {
        if (error?.code === 'KEYCHAIN_KEY_NOT_FOUND') return false;
        throw error;
      }
    },
  };
}

function runSecurityCommand(args, { captureStdout = false, timeoutMs = SECURITY_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('security', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new AppError('KEYCHAIN_TIMEOUT', 'O Chaves do macOS demorou mais que 10 segundos para responder.', { status: 504 }));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      if (captureStdout) stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', (error) => finish(reject, mapSecurityError({ cause: error })));
    child.once('close', (exitCode) => {
      if (exitCode === 0) return finish(resolve, captureStdout ? stdout : undefined);
      return finish(reject, mapSecurityError({ exitCode, stderr }));
    });

    child.stdin.end();
  });
}

function mapSecurityError({ exitCode, stderr = '', cause } = {}) {
  const normalized = stderr.toLowerCase();
  if (exitCode === 44 || normalized.includes('could not be found')) {
    return new AppError('KEYCHAIN_KEY_NOT_FOUND', 'Nenhuma chave foi encontrada no Chaves do macOS.', { status: 404, cause });
  }
  if (normalized.includes('interaction is not allowed') || normalized.includes('user interaction is not allowed') || normalized.includes('permission denied')) {
    return new AppError('KEYCHAIN_ACCESS_ERROR', 'O macOS não permitiu acessar o Chaves.', { status: 503, cause });
  }
  return new AppError('KEYCHAIN_ACCESS_ERROR', 'Não foi possível acessar o Chaves do macOS.', { status: 503, cause });
}
