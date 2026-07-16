import { Clock3, Download, Hash, ReceiptText } from 'lucide-react';

export default function ResultActions({ result }) {
  const cost = typeof result.metrics.costUsd === 'number' ? `US$ ${result.metrics.costUsd.toFixed(4)}` : 'Não informado';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><ReceiptText size={14} /> {cost}</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><Clock3 size={14} /> {formatDuration(result.metrics.durationMs)}</span>
      <span data-testid="request-id" className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><Hash size={14} /> Request ID: {result.requestId || 'Não informado'}</span>
      <a href={result.image.dataUrl} download={result.image.downloadFilename} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"><Download size={15} /> Baixar imagem</a>
    </div>
  );
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return 'Duração indisponível';
  return durationMs < 1000 ? `${durationMs} ms` : `${(durationMs / 1000).toFixed(1)} s`;
}
