import { AlertCircle, ArrowUpRight, Clock3, ImageOff, ReceiptText } from 'lucide-react';

export const ITEM_STATUS = {
  queued: ['Na fila', 'bg-slate-100 text-slate-600'],
  preparing: ['Preparando', 'bg-blue-50 text-blue-700'],
  generating: ['Gerando', 'bg-blue-50 text-blue-700'],
  completed: ['Concluído', 'bg-emerald-50 text-emerald-700'],
  failed: ['Falhou', 'bg-rose-50 text-rose-700'],
  cancelled: ['Cancelado', 'bg-slate-100 text-slate-500'],
  interrupted: ['Interrompido', 'bg-amber-50 text-amber-700'],
};

function formatDuration(value) { return Number.isFinite(value) ? (value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`) : null; }
function formatCost(value) { return Number.isFinite(value) ? `US$ ${value.toFixed(4)}` : null; }

export default function BatchItemRow({ batchId, item, onOpenResult }) {
  const [statusLabel, statusClass] = ITEM_STATUS[item.status] || ITEM_STATUS.queued;
  const duration = formatDuration(item.durationMs);
  const cost = formatCost(item.costUsd);
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {item.garmentMime ? (
            <img src={`/api/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(item.id)}/garment`} alt={item.originalFileName} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400"><ImageOff size={16} /></div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{item.originalFileName}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {item.garmentDimensions?.width ? `${item.garmentDimensions.width}×${item.garmentDimensions.height} · ` : ''}
            {item.garmentMime || 'Formato não informado'}
          </p>
          {item.safeError && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {item.safeError.message}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span>
        {cost && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><ReceiptText size={12} />{cost}</span>}
        {duration && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 size={12} />{duration}</span>}
        {item.resultId && (
          <button type="button" onClick={() => onOpenResult?.(item.resultId)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            <ArrowUpRight size={13} /> Abrir resultado
          </button>
        )}
      </div>
    </li>
  );
}
