import path from 'node:path';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getAiProvider } from '../catalogs/aiProviders.js';
import { serializeJson, writeFileAtomically } from '../utils/atomicJsonStorage.js';

const DEFAULT_DATA = Object.freeze({
  schemaVersion: 1,
  dashboard: Object.freeze({ usdToBrlRate: 5.5 }),
  providers: Object.freeze([
    Object.freeze({ provider: 'openrouter', modelId: null, lastTestedAt: null, lastTestStatus: 'never' }),
    Object.freeze({ provider: 'deepseek', modelId: 'deepseek-v4-flash', lastTestedAt: null, lastTestStatus: 'never' }),
  ]),
});

export function createLocalAiSettingsRepository({
  settingsDir = path.resolve(process.cwd(), 'storage/settings'),
  fsImpl = { mkdir, readFile, writeFile, rename, unlink },
  uuid = randomUUID,
} = {}) {
  const filePath = path.join(settingsDir, 'ai-providers.json');
  const backupPath = path.join(settingsDir, 'ai-providers.json.bak');
  let mutation = Promise.resolve();

  async function ensureInitialized() {
    await fsImpl.mkdir(settingsDir, { recursive: true });
    const existing = await readRecoverable();
    if (!existing) await persist(clone(DEFAULT_DATA), clone(DEFAULT_DATA));
  }

  async function getAll() {
    await ensureInitialized();
    return clone((await readRecoverable()) || DEFAULT_DATA);
  }

  async function get(provider) {
    const data = await getAll();
    return clone(data.providers.find((item) => item.provider === provider) || defaultProvider(provider));
  }

  async function update(provider, updater) {
    return serialize(async () => {
      const previous = await getAll();
      const current = previous.providers.find((item) => item.provider === provider) || defaultProvider(provider);
      const nextProvider = normalizeProvider(await updater(clone(current)));
      const next = clone(previous);
      const index = next.providers.findIndex((item) => item.provider === provider);
      if (index >= 0) next.providers[index] = nextProvider;
      else next.providers.push(nextProvider);
      await persist(previous, next);
      return clone(nextProvider);
    });
  }

  async function getDashboardSettings() {
    const data = await getAll();
    return clone(data.dashboard);
  }

  async function updateDashboardSettings(updater) {
    return serialize(async () => {
      const previous = await getAll();
      const next = clone(previous);
      next.dashboard = normalizeDashboardSettings(await updater(clone(previous.dashboard)));
      await persist(previous, next);
      return clone(next.dashboard);
    });
  }

  async function persist(previous, next) {
    await fsImpl.mkdir(settingsDir, { recursive: true });
    await writeFileAtomically(backupPath, serializeJson(previous), { fsImpl, uuid, errorCode: 'AI_SETTINGS_SAVE_FAILED', errorMessage: 'Não foi possível salvar o backup das configurações de IA.' });
    await writeFileAtomically(filePath, serializeJson(next), { fsImpl, uuid, errorCode: 'AI_SETTINGS_SAVE_FAILED', errorMessage: 'Não foi possível salvar as configurações de IA.' });
  }

  async function readRecoverable() {
    const primary = await readJson(filePath, fsImpl);
    const backup = await readJson(backupPath, fsImpl);
    const selected = isValid(primary) ? primary : isValid(backup) ? backup : null;
    if (selected && selected !== primary) {
      await writeFileAtomically(filePath, serializeJson(selected), { fsImpl, uuid, errorCode: 'AI_SETTINGS_SAVE_FAILED', errorMessage: 'Não foi possível recuperar as configurações de IA.' });
    }
    if (!selected) return null;
    const normalized = normalize(selected);
    if (JSON.stringify(normalized) !== JSON.stringify(selected)) {
      await writeFileAtomically(backupPath, serializeJson(selected), { fsImpl, uuid, errorCode: 'AI_SETTINGS_SAVE_FAILED', errorMessage: 'Não foi possível salvar o backup das configurações de IA.' });
      await writeFileAtomically(filePath, serializeJson(normalized), { fsImpl, uuid, errorCode: 'AI_SETTINGS_SAVE_FAILED', errorMessage: 'Não foi possível migrar as configurações de IA.' });
    }
    return normalized;
  }

  function serialize(operation) {
    const next = mutation.then(operation, operation);
    mutation = next.catch(() => {});
    return next;
  }

  return Object.freeze({ ensureInitialized, getAll, get, update, getDashboardSettings, updateDashboardSettings, paths: Object.freeze({ filePath, backupPath }) });
}

function defaultProvider(provider) {
  const definition = getAiProvider(provider);
  return { provider, modelId: definition?.defaultModelId || null, lastTestedAt: null, lastTestStatus: 'never' };
}
function normalize(data) { return { schemaVersion: 1, dashboard: normalizeDashboardSettings(data.dashboard), providers: data.providers.map(normalizeProvider) }; }
function normalizeDashboardSettings(value) {
  const rate = Number(value?.usdToBrlRate);
  return { usdToBrlRate: Number.isFinite(rate) && rate > 0 && decimalPlaces(rate) <= 4 ? rate : DEFAULT_DATA.dashboard.usdToBrlRate };
}
function decimalPlaces(value) { return (String(value).split('.')[1] || '').length; }
function normalizeProvider(value) {
  const fallback = defaultProvider(value.provider);
  const definition = getAiProvider(value.provider);
  const modelAllowed = definition?.models?.some((model) => model.id === value.modelId);
  return {
    provider: value.provider,
    modelId: definition?.models ? (modelAllowed ? value.modelId : fallback.modelId) : null,
    lastTestedAt: typeof value.lastTestedAt === 'string' ? value.lastTestedAt : null,
    lastTestStatus: ['never', 'success', 'failed'].includes(value.lastTestStatus) ? value.lastTestStatus : 'never',
  };
}
function isValid(value) { return Boolean(value && value.schemaVersion === 1 && Array.isArray(value.providers)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
async function readJson(filePath, fsImpl) { try { return JSON.parse(await fsImpl.readFile(filePath, 'utf8')); } catch { return null; } }
