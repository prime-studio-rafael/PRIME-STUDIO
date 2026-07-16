import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

const steps = [
  ['preparing', 'Validando e preparando'],
  ['generating', 'Gerando e salvando localmente'],
  ['success', 'Concluído'],
];

export default function GenerationProgress({ status, error }) {
  const activeIndex = status === 'preparing' ? 0 : status === 'generating' ? 1 : status === 'success' ? 2 : -1;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
      {status === 'error' ? (
        <div className="flex items-center gap-3 text-sm font-semibold text-rose-700"><XCircle size={18} /> {error?.message || 'A geração falhou.'}</div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {steps.map(([step, label], index) => {
            const complete = status === 'success' || index < activeIndex;
            const active = index === activeIndex;
            return <div key={step} className={`flex items-center gap-2 text-xs font-semibold ${complete || active ? 'text-slate-900' : 'text-slate-400'}`}>
              {complete ? <CheckCircle2 size={16} className="text-emerald-500" /> : active ? <Loader2 size={16} className="animate-spin text-slate-700" /> : <Circle size={16} />}
              {label}
            </div>;
          })}
        </div>
      )}
    </section>
  );
}
