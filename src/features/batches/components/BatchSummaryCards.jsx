import { AlertCircle, CheckCircle2, Clock3, Layers3, Loader2 } from 'lucide-react';

const TILES = [
  { key: 'total', label: 'Total', icon: Layers3, tone: 'text-slate-600' },
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {TILES.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} data-testid={`summary-${key}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Icon size={13} className={tone} />
            {label}
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{counts[key]}</p>
        </div>
      ))}
    </div>
  );
}
