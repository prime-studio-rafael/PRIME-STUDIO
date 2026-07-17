import { AlertCircle, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useObjectUrl } from '../../generation/utils/imagePreview.js';
import { inspectTemplateFile } from '../utils/inspectTemplateUpload.js';
import { DEFAULT_TEMPLATE_CATEGORY_ID } from '../hooks/useTemplateLibraryFilters.js';
import TemplateCategorySelect from './TemplateCategorySelect.jsx';

const TITLES = {
  create: 'Novo template',
  edit: 'Editar template',
  replace: 'Substituir imagem',
};

export default function TemplateFormModal({ open, mode, template, policy, categories = [], busy, onClose, onSubmit }) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_TEMPLATE_CATEGORY_ID);
  const [tagsInput, setTagsInput] = useState('');
  const [hoverDescription, setHoverDescription] = useState('');
  const [file, setFile] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [localError, setLocalError] = useState('');
  const firstInputRef = useRef(null);
  const inspectionRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const previewUrl = useObjectUrl(file);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    setLabel(template?.label || '');
    setDescription(template?.description || '');
    setCategory(template?.category || DEFAULT_TEMPLATE_CATEGORY_ID);
    setTagsInput((template?.tags || []).join(', '));
    setHoverDescription(template?.hoverDescription || '');
    setFile(null);
    setAssessment(null);
    setLocalError('');
    const focusTimer = setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => clearTimeout(focusTimer);
  }, [open, mode, template?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy]);

  if (!open) return null;

  const needsFile = mode === 'create' || mode === 'replace';
  const canSubmit = Boolean(!busy && !inspecting && label.trim() && (!needsFile || (file && assessment?.valid)));

  async function handleFile(nextFile) {
    const sequence = inspectionRef.current + 1;
    inspectionRef.current = sequence;
    setFile(nextFile);
    setAssessment(null);
    setLocalError('');
    if (!nextFile) return;
    setInspecting(true);
    try {
      const result = await inspectTemplateFile(nextFile, policy);
      if (inspectionRef.current === sequence) setAssessment(result);
    } catch {
      if (inspectionRef.current === sequence) setLocalError('Não foi possível ler este arquivo. Exporte a imagem novamente.');
    } finally {
      if (inspectionRef.current === sequence) setInspecting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      setLocalError('');
      const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
      await onSubmit({ label: label.trim(), description: description.trim(), category, tags, hoverDescription: hoverDescription.trim(), file });
    } catch (error) {
      setLocalError(error.message || 'Não foi possível salvar o template.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="template-modal-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Templates locais</p>
            <h2 id="template-modal-title" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">{TITLES[mode]}</h2>
          </div>
          <button type="button" aria-label="Fechar" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {mode !== 'replace' && (
            <>
              <label className="block text-sm font-semibold text-slate-800">
                Nome
                <input ref={firstInputRef} value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-100" />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Descrição <span className="font-normal text-slate-400">(opcional)</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} rows={3} disabled={busy} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-100" />
              </label>
              <label className="block text-sm font-semibold text-slate-800" htmlFor="template-category-input">
                Categoria
                <TemplateCategorySelect categories={categories} value={category} onChange={setCategory} disabled={busy} />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Tags <span className="font-normal text-slate-400">(separadas por vírgula, opcional)</span>
                <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="casual, verão" disabled={busy} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-100" />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Texto do tooltip <span className="font-normal text-slate-400">(opcional — aparece ao passar o mouse)</span>
                <input value={hoverDescription} onChange={(event) => setHoverDescription(event.target.value)} maxLength={160} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-100" />
              </label>
            </>
          )}

          {mode === 'replace' && <input ref={firstInputRef} className="sr-only" aria-hidden="true" />}

          {needsFile && (
            <div>
              <label className="block text-sm font-semibold text-slate-800" htmlFor="template-image-input">Imagem-base</label>
              <label htmlFor="template-image-input" className="mt-2 flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 transition hover:border-slate-500">
                <ImagePlus size={20} />
                {file ? file.name : 'Selecionar JPEG, PNG ou WebP'}
              </label>
              <input id="template-image-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => handleFile(event.target.files?.[0] || null)} className="sr-only" />
            </div>
          )}

          {previewUrl && (
            <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[180px_1fr]">
              <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                <img src={previewUrl} alt="Prévia do template" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                {inspecting && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin" /> Validando imagem…</p>}
                {assessment && <Assessment assessment={assessment} />}
              </div>
            </div>
          )}

          {localError && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{localError}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Cancelar</button>
            <button type="submit" disabled={!canSubmit} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
              {busy && <Loader2 size={15} className="animate-spin" />}{busy ? 'Salvando…' : 'Salvar template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Assessment({ assessment }) {
  const { inspection } = assessment;
  return (
    <div className="space-y-3 text-xs">
      <p className={`flex items-center gap-2 font-semibold ${assessment.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
        {assessment.valid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        {assessment.valid ? assessment.qualityLabel : 'Imagem inválida'}
      </p>
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="text-slate-400">Formato real</dt><dd className="mt-0.5 font-semibold text-slate-700">{inspection.format?.toUpperCase() || '—'}</dd></div>
        <div><dt className="text-slate-400">Dimensões</dt><dd className="mt-0.5 font-semibold text-slate-700">{inspection.width}×{inspection.height}</dd></div>
        <div><dt className="text-slate-400">Proporção</dt><dd className="mt-0.5 font-semibold text-slate-700">{Number.isFinite(inspection.aspectRatio) ? inspection.aspectRatio.toFixed(3).replace('.', ',') : '—'}</dd></div>
        <div><dt className="text-slate-400">Tamanho</dt><dd className="mt-0.5 font-semibold text-slate-700">{formatBytes(inspection.sizeBytes)}</dd></div>
      </dl>
      {assessment.errors.map((issue) => <p key={issue.code} className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{issue.message}</p>)}
      {assessment.warnings.map((issue) => <p key={issue.code} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{issue.message}</p>)}
    </div>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
}
