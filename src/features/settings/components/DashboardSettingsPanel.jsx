import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { updateDashboardSettings } from '../api/aiSettingsClient.js';

function formatRate(value) { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value); }
function parseRate(value) {
  const text = value.trim();
  if (!/^\d+(?:,\d{1,4})?$/.test(text)) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function DashboardSettingsPanel({ settings, onChange }) {
  const rate = settings?.usdToBrlRate ?? 5.5;
  const [value, setValue] = useState(() => formatRate(rate));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const parsed = parseRate(value);
  const invalid = value.length > 0 && parsed === null;

  useEffect(() => { setValue(formatRate(rate)); }, [rate]);

  async function save(event) {
    event.preventDefault();
    if (busy || parsed === null) return;
    setBusy(true); setFeedback('');
    try {
      const next = await updateDashboardSettings(parsed);
      onChange?.(next);
      setValue(formatRate(next.usdToBrlRate));
      setFeedback('Cotação salva localmente.');
    } catch (error) {
      setFeedback(error.message || 'Não foi possível salvar a cotação local.');
    } finally { setBusy(false); }
  }

  return <div className="space-y-5 p-5 sm:p-6"><div><p className="text-sm font-semibold text-slate-950">Dashboard</p><p className="mt-1 text-sm leading-5 text-slate-500">Preferências locais usadas apenas para leitura dos custos no Dashboard.</p></div><form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5"><label htmlFor="usd-to-brl-rate" className="text-sm font-semibold text-slate-900">Cotação do dólar</label><p className="mt-1 text-xs leading-5 text-slate-500">Usada para converter os custos das IAs de USD para BRL no Dashboard. A cotação é manual e não consulta serviços externos.</p><div className="mt-4 max-w-xs"><div className={`flex items-center rounded-xl border bg-white px-3 transition ${invalid ? 'border-rose-300 focus-within:ring-2 focus-within:ring-rose-100' : 'border-slate-200 focus-within:border-slate-950 focus-within:ring-2 focus-within:ring-slate-950/10'}`}><span className="pr-2 text-sm font-semibold text-slate-500">R$</span><input id="usd-to-brl-rate" aria-describedby="usd-to-brl-rate-help" inputMode="decimal" value={value} onChange={(event) => { setValue(event.target.value); setFeedback(''); }} placeholder="5,50" className="min-w-0 flex-1 bg-transparent py-3 text-sm font-medium text-slate-950 outline-none"/></div><p id="usd-to-brl-rate-help" className={`mt-2 text-xs ${invalid ? 'text-rose-700' : 'text-slate-400'}`}>{invalid ? 'Informe um número maior que zero, usando vírgula e até quatro casas decimais.' : 'Exemplo: 5,50'}</p></div><button type="submit" disabled={busy || parsed === null} className="mt-4 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{busy ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}Salvar</button>{feedback && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${feedback === 'Cotação salva localmente.' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{feedback}</p>}</form></div>;
}

export { formatRate, parseRate };
