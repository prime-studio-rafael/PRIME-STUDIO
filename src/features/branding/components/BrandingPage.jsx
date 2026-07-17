import { useRef, useState } from 'react';
import { AlertCircle, BadgeCheck, Check, ImageOff, Loader2, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { BRANDING_APPROVED_LOGO_URL, BRANDING_PENDING_LOGO_URL, BRANDING_PREVIEW_BRANDED_URL, BRANDING_PREVIEW_ORIGINAL_URL } from '../api/brandingClient.js';
import useBranding from '../hooks/useBranding.js';

const QUALITY = {
  adequate: ['Adequada', 'bg-emerald-50 text-emerald-700'],
  acceptable_with_warning: ['Aceitável com aviso', 'bg-amber-50 text-amber-700'],
  inadequate: ['Inadequada', 'bg-rose-50 text-rose-700'],
};

export default function BrandingPage({ open, variant = 'panel' }) {
  const branding = useBranding(open);
  const inputRef = useRef();
  const [fileError, setFileError] = useState('');

  if (branding.status === 'loading' && !branding.state) {
    return <div className="flex min-h-[220px] items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={22} /></div>;
  }
  if (branding.status === 'error' && !branding.state) {
    return <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={17} /><div><p>{branding.error}</p><button type="button" onClick={() => branding.load().catch(() => {})} className="mt-2 font-semibold underline">Tentar novamente</button></div></div>;
  }

  const state = branding.state || { config: { enabled: false }, pending: null, approved: null };
  const { pending, approved, config } = state;

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileError('');
    try { await branding.upload(file); } catch (error) { setFileError(error.message); }
  }

  return (
    <div className="space-y-5">
      {variant === 'page' && (
        <header className="mb-3 border-b border-slate-200/80 pb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"><BadgeCheck size={14} /> PRIME IA STUDIO</div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950">Branding</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Gerencie a logo da PRIME STORE e o overlay automático aplicado às imagens finais.</p>
        </header>
      )}
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Logo da loja</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">Envie um PNG com transparência real. Depois de aprovada, a logo pode ser aplicada automaticamente (canto inferior direito) sobre as imagens finais, sem uso de IA.</p>
      </div>

      {!pending && !approved && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 py-8 text-center">
          <ImageOff size={24} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-700">Nenhuma logo enviada ainda</p>
        </div>
      )}

      {approved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><ShieldCheck size={16} /> Logo ativa (aprovada)</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-emerald-200 bg-white"><img src={`${BRANDING_APPROVED_LOGO_URL}&t=${encodeURIComponent(approved.approvedAt || '')}`} alt="Logo aprovada" className="h-full w-full object-contain" /></div>
            <div className="text-xs text-emerald-800">
              <p>{approved.dimensions?.width}×{approved.dimensions?.height} · {(approved.sizeBytes / 1024).toFixed(0)} KB</p>
              <p className="mt-0.5">Aprovada em {formatDate(approved.approvedAt)}</p>
            </div>
          </div>
          <button type="button" disabled={branding.mutationPending} onClick={() => branding.remove().catch(() => {})} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">
            <Trash2 size={13} /> Remover logo
          </button>
        </div>
      )}

      {pending && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Logo enviada, aguardando aprovação</p>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${QUALITY[pending.quality]?.[1] || 'bg-slate-100 text-slate-600'}`}>{QUALITY[pending.quality]?.[0] || pending.quality}</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"><img src={`${BRANDING_PENDING_LOGO_URL}&t=${encodeURIComponent(pending.uploadedAt || '')}`} alt="Preview da logo enviada" className="h-full w-full object-contain" /></div>
            <div className="text-xs text-slate-600">
              <p>{pending.dimensions?.width}×{pending.dimensions?.height} · {(pending.sizeBytes / 1024).toFixed(0)} KB</p>
              <p className="mt-0.5">Área útil da arte: {Math.round((pending.canvasOccupancyRatio || 0) * 100)}% do canvas</p>
            </div>
          </div>
          {pending.errors?.length > 0 && (
            <ul className="mt-3 space-y-1">{pending.errors.map((issue) => <li key={issue.code} className="flex items-start gap-1.5 text-xs text-rose-700"><AlertCircle size={13} className="mt-0.5 shrink-0" />{issue.message}</li>)}</ul>
          )}
          {pending.warnings?.length > 0 && (
            <ul className="mt-2 space-y-1">{pending.warnings.map((issue) => <li key={issue.code} className="flex items-start gap-1.5 text-xs text-amber-700"><AlertCircle size={13} className="mt-0.5 shrink-0" />{issue.message}</li>)}</ul>
          )}
          <button type="button" disabled={branding.mutationPending || pending.quality === 'inadequate'} title={pending.quality === 'inadequate' ? 'Esta logo é inadequada e não pode ser aprovada.' : undefined} onClick={() => branding.approve().catch(() => {})} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
            {branding.mutationPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar logo
          </button>
        </div>
      )}

      <div>
        <input ref={inputRef} type="file" accept="image/png" className="hidden" onChange={handleFileChange} />
        <button type="button" disabled={branding.mutationPending} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-50">
          {branding.mutationPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {approved || pending ? 'Enviar outra logo (PNG)' : 'Enviar logo (PNG)'}
        </button>
        {(fileError || branding.error) && <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700"><AlertCircle size={13} className="mt-0.5 shrink-0" />{fileError || branding.error}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Prévia da aplicação</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">Prévia da aplicação: logo com escala de 9%, margem de 3% e posição inferior direita.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1.5 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">Original</span>
            <div className="aspect-[4/5] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <img src={BRANDING_PREVIEW_ORIGINAL_URL} alt="Prévia original, sem a logo aplicada" className="h-full w-full object-contain" />
            </div>
          </div>
          <div>
            <span className="mb-1.5 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">Com logo</span>
            {approved ? (
              <div className="aspect-[4/5] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img src={`${BRANDING_PREVIEW_BRANDED_URL}&t=${encodeURIComponent(approved.approvedAt || '')}`} alt="Prévia com a logo aplicada no canto inferior direito" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-center">
                <ImageOff size={18} className="text-slate-400" />
                <p className="text-[11px] leading-4 text-slate-500">Aprove uma logo para ver a prévia com a marca aplicada.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Aplicar logo nas imagens</p>
          <p className="mt-0.5 text-xs text-slate-500">Vale para a geração individual e para a Produção em Lotes.</p>
        </div>
        <input
          type="checkbox"
          checked={Boolean(config.enabled)}
          disabled={branding.mutationPending || !approved}
          onChange={(event) => branding.setEnabled(event.target.checked).catch(() => {})}
          aria-label="Aplicar logo nas imagens"
        />
      </label>
    </div>
  );
}

function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
