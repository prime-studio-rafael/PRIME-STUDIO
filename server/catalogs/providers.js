const providers = Object.freeze([
  { id: 'openrouter', label: 'OpenRouter' },
]);

export function listProviders() {
  return providers;
}

export function getProviderById(id) {
  return providers.find((provider) => provider.id === id) || null;
}
