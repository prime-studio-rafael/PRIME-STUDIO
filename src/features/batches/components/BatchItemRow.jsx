import { useState } from 'react';
import { AlertCircle, Clock3, Eye, ImageOff, Loader2, ReceiptText } from 'lucide-react';

export const ITEM_STATUS = {
  queued: ['Na fila', 'bg-slate-100 text-slate-600', 'bg-slate-400'],
  preparing: ['Preparando', 'bg-blue-50 text-blue-700', 'bg-blue-500'],
  generating: ['Gerando', 'bg-blue-50 text-blue-700', 'bg-blue-500'],
  completed: ['Concluído', 'bg-emerald-50 text-emerald-700', 'bg-emerald-500'],
  failed: ['Falhou', 'bg-rose-50 text-rose-700', 'bg-rose-500'],
  cancelled: ['Cancelado', 'bg-slate-100 text-slate-500', 'bg-slate-400'],
  interrupted: ['Interrompido', 'bg-amber-50 text-amber-700', 'bg-amber-500'],
};

// Prévia visual do progresso, derivada apenas da etapa real do item — nunca um percentual
// contínuo devolvido pelo OpenRouter, nunca persistido. cancelled/interrupted não têm um
// percentual honesto a mostrar, então ficam de fora deste mapa (renderizam traço).
const PROGRESS_BY_STATUS = { queued: 0, preparing: 25, generating: 70, completed: 100, failed: 100 };
function getVisualProgress(status) {
  return status in PROGRESS_BY_STATUS ? PROGRESS_BY_STATUS[status] : null;
}

// O grid `grid-cols-[minmax(0,2.2fr)_104px_168px_72px_92px_56px_104px]` e o piso `min-w-[840px]`
// (Produto / Status / Progresso / Tempo / Custo / Resultado / Ações) são repetidos literalmente
// aqui e no cabeçalho em BatchesPage.jsx — o Tailwind só gera o CSS de uma classe `sm:grid-cols-
// [...]`/`sm:min-w-[...]` quando a string completa aparece de forma literal no código-fonte, então
// não pode ser montada em runtime a partir de uma constante interpolada. O piso de 840px foi
// escolhido por ficar abaixo da largura natural em notebook (~1280px, sem exigir scroll ali) e
// acima da largura natural em tablet (1024px e 768px, onde o wrapper com overflow-x-auto em
// BatchesPage.jsx assume o scroll horizontal — restrito à tabela, nunca à página inteira).

function formatDuration(value) { return Number.isFinite(value) ? (value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`) : null; }
function formatCost(value) { return Number.isFinite(value) ? `US$ ${value.toFixed(4)}` : null; }

export default function BatchItemRow({ batchId, item, onOpenResult }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [statusLabel, statusClass, dotClass] = ITEM_STATUS[item.status] || ITEM_STATUS.queued;
  const duration = formatDuration(item.durationMs);
  const cost = formatCost(item.costUsd);
  const progress = getVisualProgress(item.status);
  const resultThumbnailUrl = item.resultId ? `/api/results/${encodeURIComponent(item.resultId)}/assets/result` : null;

  const product = (
    <div className="flex min-w-0 items-center gap-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {item.garmentMime && !imageFailed ? (
          <img
            src={`/api/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(item.id)}/garment`}
            alt={item.originalFileName}
            className="h-full w-full object-contain"
            onError={() => setImageFailed(true)}
          />
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
  );

  const status = (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">Status</span>
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
        {statusLabel}
      </span>
    </div>
  );

  const progressCell = (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">Progresso</span>
      {progress == null ? (
        <span className="text-xs text-slate-400">—</span>
      ) : (
        <>
          <div className="h-1.5 w-full max-w-[104px] overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out ${item.status === 'failed' ? 'bg-rose-500' : 'bg-slate-900'} ${item.status === 'generating' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-slate-500">{progress}%</span>
        </>
      )}
    </div>
  );

  const time = (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">Tempo</span>
      <span className="inline-flex items-center gap-1">{duration ? <><Clock3 size={12} />{duration}</> : '—'}</span>
    </span>
  );
  const costCell = (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">Custo</span>
      <span className="inline-flex items-center gap-1">{cost ? <><ReceiptText size={12} />{cost}</> : '—'}</span>
    </span>
  );

  const result = (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">Resultado</span>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {resultThumbnailUrl ? (
          <img src={resultThumbnailUrl} alt="Miniatura do resultado" className="h-full w-full object-contain" />
        ) : item.status === 'preparing' || item.status === 'generating' ? (
          <Loader2 size={14} className="animate-spin text-slate-400" />
        ) : item.status === 'failed' ? (
          <AlertCircle size={14} className="text-rose-500" />
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </div>
    </div>
  );

  const actions = resultThumbnailUrl ? (
    <button
      type="button"
      onClick={() => onOpenResult?.(item.resultId)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <Eye size={13} /> Abrir resultado
    </button>
  ) : (
    <span className="text-xs text-slate-300">—</span>
  );

  return (
    <li className="transition-colors duration-200 hover:bg-slate-50/50">
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 px-1 py-3 sm:grid sm:min-w-[840px] sm:grid-cols-[minmax(0,2.2fr)_104px_168px_72px_92px_56px_104px] sm:items-center sm:gap-y-0 sm:px-3">
        {product}
        {status}
        {progressCell}
        {time}
        {costCell}
        {result}
        <div className="flex justify-start sm:justify-end">{actions}</div>
      </div>
    </li>
  );
}
