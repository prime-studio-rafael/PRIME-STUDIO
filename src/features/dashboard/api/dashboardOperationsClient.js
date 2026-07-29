const TIMEOUT_MS = 10_000;

export async function fetchLocalHealth() {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('/api/health', { signal: controller.signal }); const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível ler a saúde local.');
    return body;
  } finally { clearTimeout(timer); }
}
