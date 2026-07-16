export function readEnv(env = process.env) {
  return Object.freeze({
    apiKey: String(env.OPENROUTER_API_KEY || '').trim(),
    port: Number(env.PORT || 3001),
  });
}
