import { AlertCircle, CheckCircle2, Clock3, Layers3, Loader2 } from 'lucide-react';
import { getBatchOperationalSummary } from '../batchOperations.js';

const TILES = [
  { key: 'total', label: 'Total', icon: Layers3, tone: 'text-slate-500' },
  { key: 'completed', label: 'Concluídos', icon: CheckCircle2, tone: 'text-emerald-600' },
  { key: 'processing', label: 'Processando', icon: Loader2, tone: 'text-blue-600' },
  { key: 'pending', label: 'Pendentes', icon: Clock3, tone: 'text-slate-500' },
  { key: 'failed', label: 'Falhos', icon: AlertCircle, tone: 'text-rose-600' },
];

export default function BatchSummaryCards({ items }) {
  const counts = getBatchOperationalSummary(items);
  const optionalTiles = [
    counts.cancelled > 0 && { key: 'cancelled', label: 'Cancelados', icon: Clock3, tone: 'text-slate-500' },
    counts.interrupted > 0 && { key: 'interrupted', label: 'Interrompidos', icon: AlertCircle, tone: 'text-amber-600' },
  ].filter(Boolean);
  const tiles = [...TILES, ...optionalTiles];
  const hasOddTileCount = tiles.length % 2 === 1;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-5">
      {tiles.map(({ key, label, icon: Icon, tone }, index) => (
        <div key={key} data-testid={`summary-${key}`} className={`flex min-w-0 items-center gap-3 bg-white px-4 py-3.5 sm:px-5 ${hasOddTileCount && index === tiles.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}>
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
