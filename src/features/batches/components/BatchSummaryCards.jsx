import { AlertCircle, CheckCircle2, Clock3, Layers3, Loader2 } from 'lucide-react';

const TILES = [
  { key: 'total', label: 'Total', icon: Layers3, tone: 'text-slate-500' },
  { key: 'completed', label: 'Concluídos', icon: CheckCircle2, tone: 'text-emerald-600' },
  { key: 'processing', label: 'Processando', icon: Loader2, tone: 'text-blue-600' },
  { key: 'waiting', label: 'Aguardando', icon: Clock3, tone: 'text-slate-500' },
  { key: 'errors', label: 'Erros', icon: AlertCircle, tone: 'text-rose-600' },
];

export default function BatchSummaryCards({ items }) {
  const counts = {
    total: items.length,
    completed: items.filter((item) => item.status === 'completed').length,
    processing: items.filter((item) => item.status === 'preparing' || item.status === 'generating').length,
    waiting: items.filter((item) => item.status === 'queued').length,
    errors: items.filter((item) => item.status === 'failed').length,
  };
  return (
    <div className="flex flex-wrap divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:divide-y-0 sm:divide-x">
      {TILES.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} data-testid={`summary-${key}`} className="flex min-w-[7rem] flex-1 items-center gap-3 px-5 py-3.5">
          <Icon size={15} className={`shrink-0 ${tone}`} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950">{counts[key]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
