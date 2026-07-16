import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { readEnv } from './config/env.js';
import { createOpenRouterKeyStore } from './secrets/openrouterKeyStore.js';
import { createOpenRouterKeyResolver } from './secrets/openrouterKeyResolver.js';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(projectDirectory, '.env'), quiet: true });
const env = readEnv();
const keyStore = createOpenRouterKeyStore();
const keyResolver = createOpenRouterKeyResolver({ keyStore, getEnvKey: () => env.apiKey });
const app = createApp({ env, keyStore, keyResolver });

const server = app.listen(env.port, '127.0.0.1', async () => {
  console.log(`[api] PRIME IA STUDIO local em http://127.0.0.1:${env.port}`);
  try {
    const keyStatus = await keyResolver.getStatus();
    console.log(`[api] Chave ${keyStatus.configured ? 'configurada' : 'não configurada'}`);
  } catch {
    console.log('[api] Não foi possível confirmar o acesso ao Chaves do macOS.');
  }
});

server.on('error', (error) => {
  console.error('[api] Não foi possível iniciar o servidor local.', error?.code || error?.message || error);
  process.exitCode = 1;
});
