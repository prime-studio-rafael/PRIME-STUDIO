import { ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function AiProviderOverview({ providers, loading, error, onConfigure }) {
  if (loading) return <p className="p-6 text-sm text-slate-500">Carregando provedores…</p>;
  if (error) return <p role="alert" className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>;
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
      {providers.map((provider) => (
        <article key={provider.provider} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="font-semibold text-slate-950">{provider.label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{provider.purpose}</p></div>
            {provider.configured ? <CheckCircle2 size={18} className="text-emerald-600" /> : <ShieldAlert size={18} className="text-amber-600" />}
          </div>
          <dl className="mt-4 space-y-2 text-xs">
            <Row label="Status" value={provider.configured ? 'Configurado' : 'Não configurado'} />
            <Row label="Modelo" value={provider.modelLabel || provider.modelId || 'Não informado'} />
            <Row label="Último teste bem-sucedido" value={formatDate(provider.lastTestedAt)} />
          </dl>
          <button type="button" onClick={() => onConfigure(provider.provider)} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-950">Configurar <ArrowRight size={15} /></button>
        </article>
      ))}
    </div>
  );
}

function Row({ label, value }) { return <div className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-800">{value}</dd></div>; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Não informado'; }
