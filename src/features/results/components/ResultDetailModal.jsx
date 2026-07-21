import { useState } from 'react';
import { Check, Download, Loader2, Sparkles, Trash2, X, XCircle } from 'lucide-react';
import ComparisonGrid from '../../generation/components/ComparisonGrid.jsx';
import ResultActions from '../../generation/components/ResultActions.jsx';
import SectionCard from '../../../components/ui/SectionCard.jsx';
import { formatDate } from './ResultCard.jsx';
export default function ResultDetailModal({ result, busy, error, onClose, onStatus, onDelete }) {
  const hasBranded = Boolean(result?.assets.branded);
  const [variant, setVariant] = useState(hasBranded ? 'branded' : 'original');
  const [lastResultId, setLastResultId] = useState(result?.id);
  // Ajuste síncrono durante a renderização (sem useEffect) para nunca exibir um frame com o variant do resultado anterior.
  if (result?.id !== lastResultId) {
    setLastResultId(result?.id);
    setVariant(hasBranded ? 'branded' : 'original');
  }
  if (!result) return null;
  const activeAssetUrl = variant === 'branded' && result.assets.branded ? result.assets.branded : result.assets.result;
  const historyResult = { metrics: { costUsd: result.costUsd, durationMs: result.durationMs }, requestId: result.providerRequestId, image: { dataUrl: result.assets.result, downloadFilename: `prime-studio-${result.id}.${extension(result.outputMime)}` } };
  const previewResult = { ...historyResult, image: { ...historyResult.image, dataUrl: activeAssetUrl } };
  const template = result.assets.template ? { publicUrl: result.assets.template, label: result.templateLabel || 'Template histórico' } : null;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 sm:p-8"><div role="dialog" aria-modal="true" aria-labelledby="result-detail-title" className="mx-auto w-full max-w-6xl rounded-2xl bg-[#f7f7f8] shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Resultado local</p><h2 id="result-detail-title" className="mt-1 text-xl font-semibold text-slate-950">{formatDate(result.createdAt)}</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></header><div className="space-y-5 p-5 sm:p-6">{error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}<div className="flex flex-wrap items-center justify-between gap-3"><ResultActions result={historyResult} /><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => onStatus('approved')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Check size={15} /> Aprovar</button><button type="button" disabled={busy} onClick={() => onStatus('rejected')} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><XCircle size={15} /> Reprovar</button><button type="button" disabled={busy} onClick={onDelete} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-rose-700 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Excluir</button></div></div>{hasBranded && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><div className="flex gap-1 rounded-lg bg-slate-100 p-1"><button type="button" onClick={() => setVariant('branded')} aria-pressed={variant === 'branded'} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${variant === 'branded' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><Sparkles size={13} /> Com logo</button><button type="button" onClick={() => setVariant('original')} aria-pressed={variant === 'original'} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${variant === 'original' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Original</button></div><p className="text-xs text-slate-500">Exibindo: {variant === 'branded' ? 'versão com logo' : 'versão original'}</p><div className="ml-auto flex flex-wrap gap-2"><a href={result.assets.result} download={`prime-studio-${result.id}-original.${extension(result.outputMime)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"><Download size={12} /> Baixar original</a><a href={result.assets.branded} download={`prime-studio-${result.id}-com-logo.${extension(result.outputMime)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"><Download size={12} /> Baixar com logo</a></div></div>}<ComparisonGrid template={template} garmentPreviewUrl={result.assets.garment} result={previewResult} aspectRatio={result.effectiveAspectRatio || '1:1'} missingReferenceMessage="Referência não disponível para esta geração anterior." />{!result.assets.template && result.assets.currentTemplate && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">O snapshot histórico do template não foi preservado. Existe um template atual correspondente ao ID, mas ele pode ter sido alterado depois da geração.</div>}<SectionCard eyebrow="Metadata" title="Informações da geração"><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{metadataRows(result).map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-slate-400">{label}</dt><dd className="mt-1 break-words font-medium text-slate-700">{value ?? 'Não informado'}</dd></div>)}</dl>{result.additionalInstruction && <div className="mt-4 border-t border-slate-100 pt-4"><dt className="text-xs font-medium text-slate-400">Instrução adicional</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-slate-700">{result.additionalInstruction}</dd></div>}</SectionCard></div></div></div>;
}
function metadataRows(result) {
  const rows = [
    ['Status', result.reviewStatus],
    ['Template', result.templateLabel || result.templateId],
  ];
  if (result.templateCategory) rows.push(['Categoria', result.templateCategory]);
  rows.push(
    ['Origem', result.origin === 'batch' ? `Lote${result.batchId ? ` (${result.batchId.slice(0, 8)})` : ''}` : 'Individual'],
    ['Modelo', result.model],
    ['Prompt', result.promptVersion],
    ['Configuração', result.configurationId],
    ['Proporção', result.effectiveAspectRatio],
    ['Resolução', result.resolution],
    ['MIME', result.outputMime],
    ['Dimensões', result.outputDimensions?.width ? `${result.outputDimensions.width}×${result.outputDimensions.height}` : null],
    ['Request ID', result.providerRequestId],
    ['Logo aplicada', result.logoApplied ? 'Sim' : 'Não'],
  );
  return rows;
}
function extension(mime) { return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'; }
