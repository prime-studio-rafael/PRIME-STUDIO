const providers = Object.freeze([
  Object.freeze({ id: 'openrouter', label: 'OpenRouter', purpose: 'Geração e edição de imagens', modelLabel: 'Definido por template' }),
  Object.freeze({
    id: 'deepseek', label: 'DeepSeek', purpose: 'Textos criativos para Stories',
    models: Object.freeze([Object.freeze({ id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' })]),
    defaultModelId: 'deepseek-v4-flash',
  }),
]);

export function listAiProviders() { return providers; }
export function getAiProvider(id) { return providers.find((provider) => provider.id === id) || null; }
