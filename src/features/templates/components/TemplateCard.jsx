import { Copy, ImageOff, Pencil, Power, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import TemplateHoverCard from './TemplateHoverCard.jsx';
import TemplateTagList from './TemplateTagList.jsx';

export default function TemplateCard({ template, categories = [], disabled, onEdit, onReplace, onDuplicate, onToggle, onDelete }) {
  const [imageFailed, setImageFailed] = useState(false);
  const unavailable = !template.valid || imageFailed;
  const category = categories.find((item) => item.id === template.category);

  useEffect(() => setImageFailed(false), [template.publicUrl]);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)]" data-testid="template-card">
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-slate-100">
        {unavailable ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center text-slate-500">
            <ImageOff size={28} />
            <p className="text-xs font-semibold">Imagem indisponível</p>
            <p className="text-[11px] leading-4">{template.validationError || 'O arquivo não pôde ser carregado.'}</p>
          </div>
        ) : (
          <img src={template.publicUrl} alt={template.label} loading="lazy" className="h-full w-full object-contain" onError={() => setImageFailed(true)} />
        )}
        <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${template.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
          {template.active ? 'Ativo' : 'Inativo'}
        </span>
        <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${template.valid ? 'border-slate-200 bg-white text-slate-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {template.valid ? template.qualityLabel || 'Válido' : 'Inválido'}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5">
          <h2 className="truncate text-sm font-semibold text-slate-950">{template.label}</h2>
          <TemplateHoverCard label={template.label} tags={template.tags} hoverDescription={template.hoverDescription} fallbackDescription={template.description} disabled={disabled} />
        </div>
        <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{template.description || 'Sem descrição.'}</p>
        {category && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{category.emoji ? `${category.emoji} ` : ''}{category.label}</span>}
        <TemplateTagList tags={template.tags} className="mt-2" />
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100 py-3 text-[11px]">
          <Meta label="Formato" value={(template.realFormat || template.mimeType?.replace('image/', '') || '—').toUpperCase()} />
          <Meta label="Dimensões" value={template.width && template.height ? `${template.width}×${template.height}` : '—'} />
          <Meta label="Proporção" value={Number.isFinite(template.aspectRatio) ? template.aspectRatio.toFixed(3).replace('.', ',') : '—'} />
          <Meta label="Tamanho" value={formatBytes(template.sizeBytes)} />
        </dl>

        {template.warnings?.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
            {template.warnings[0].message}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Action icon={Pencil} label="Editar" disabled={disabled} onClick={onEdit} />
          <Action icon={RefreshCw} label="Substituir" disabled={disabled} onClick={onReplace} />
          <Action icon={Copy} label="Duplicar" disabled={disabled || !template.valid} onClick={onDuplicate} />
          <Action icon={Power} label={template.active ? 'Desativar' : 'Ativar'} disabled={disabled || (!template.active && !template.valid)} onClick={onToggle} />
        </div>
        <button type="button" disabled={disabled} onClick={onDelete} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300">
          <Trash2 size={14} /> Excluir
        </button>
      </div>
    </article>
  );
}

function Meta({ label, value }) {
  return <div><dt className="text-slate-400">{label}</dt><dd className="mt-0.5 font-semibold text-slate-700">{value}</dd></div>;
}

function Action({ icon: Icon, label, disabled, onClick }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300">
      <Icon size={13} /> {label}
    </button>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
}
