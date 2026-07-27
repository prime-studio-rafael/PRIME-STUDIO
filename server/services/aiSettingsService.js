import { getAiProvider, listAiProviders } from '../catalogs/aiProviders.js';
import { AppError } from '../utils/errors.js';

const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 512;

export function createAiSettingsService({ repository, openRouterKeyResolver, deepSeekKeyStore, deepSeekKeyValidator, clock = () => new Date() } = {}) {
  async function list() {
    const [openRouterStatus, deepSeekConfigured, metadata] = await Promise.all([
      openRouterKeyResolver.getStatus(), deepSeekKeyStore.hasKey(), repository.getAll(),
    ]);
    return listAiProviders().map((provider) => present(
      provider,
      metadata.providers.find((item) => item.provider === provider.id),
      provider.id === 'openrouter' ? openRouterStatus.configured : deepSeekConfigured,
    ));
  }

  async function getDeepSeek() { return (await list()).find((provider) => provider.provider === 'deepseek'); }

  async function saveDeepSeekKey(value) {
    let apiKey = validateKey(value);
    try { await deepSeekKeyStore.saveKey(apiKey); }
    finally { apiKey = ''; }
    return { ...(await getDeepSeek()), message: 'Chave salva com segurança no Chaves do macOS.' };
  }

  async function removeDeepSeekKey() {
    await deepSeekKeyStore.deleteKey();
    await repository.update('deepseek', (current) => ({ ...current, lastTestedAt: null, lastTestStatus: 'never' }));
    return { ...(await getDeepSeek()), message: 'A chave do DeepSeek foi removida do Chaves do macOS.' };
  }

  async function updateDeepSeekSettings(modelId) {
    const provider = getAiProvider('deepseek');
    if (!provider.models.some((model) => model.id === modelId)) throw new AppError('INVALID_DEEPSEEK_MODEL', 'Selecione um modelo DeepSeek disponível.', { status: 400 });
    await repository.update('deepseek', (current) => ({ ...current, modelId }));
    return getDeepSeek();
  }

  async function testDeepSeek() {
    const settings = await repository.get('deepseek');
    let result;
    try {
      result = await deepSeekKeyValidator.validate(settings.modelId);
    } catch (error) {
      await recordTest('deepseek', false);
      throw error;
    }
    await recordTest('deepseek', result.valid);
    return { ...result, provider: await getDeepSeek() };
  }

  async function recordOpenRouterTest(valid) { return recordTest('openrouter', valid); }
  async function recordTest(provider, valid) {
    return repository.update(provider, (current) => ({
      ...current,
      lastTestedAt: valid ? clock().toISOString() : current.lastTestedAt,
      lastTestStatus: valid ? 'success' : 'failed',
    }));
  }

  return Object.freeze({ list, getDeepSeek, saveDeepSeekKey, removeDeepSeekKey, updateDeepSeekSettings, testDeepSeek, recordOpenRouterTest });
}

function present(definition, metadata = {}, configured = false) {
  return {
    provider: definition.id,
    label: definition.label,
    purpose: definition.purpose,
    configured: Boolean(configured),
    modelId: definition.id === 'openrouter' ? null : metadata.modelId || definition.defaultModelId,
    modelLabel: definition.modelLabel || definition.models?.find((model) => model.id === metadata.modelId)?.label || definition.models?.[0]?.label || 'Não informado',
    models: definition.models || [],
    lastTestedAt: metadata.lastTestedAt || null,
    lastTestStatus: metadata.lastTestStatus || 'never',
  };
}

function validateKey(value) {
  if (typeof value !== 'string' || !value.trim()) throw new AppError('INVALID_DEEPSEEK_KEY', 'Informe uma chave do DeepSeek.', { status: 400 });
  const apiKey = value.trim();
  if (apiKey.length < MIN_KEY_LENGTH) throw new AppError('INVALID_DEEPSEEK_KEY', 'A chave informada parece curta demais.', { status: 400 });
  if (apiKey.length > MAX_KEY_LENGTH) throw new AppError('INVALID_DEEPSEEK_KEY', 'A chave informada é grande demais.', { status: 400 });
  return apiKey;
}
