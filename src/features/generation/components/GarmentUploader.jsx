import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileImage, Info, Loader2, UploadCloud, X } from 'lucide-react';
import SectionCard from '../../../components/ui/SectionCard.jsx';
import { formatBytes, formatRatio, imagePolicy } from '../../../../shared/imagePolicy.js';

export default function GarmentUploader({
  file,
  previewUrl,
  assessment,
  inspecting = false,
  policy = imagePolicy,
  error,
  disabled = false,
  onFileChange,
  onPreviewError,
  onError,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  function acceptFile(nextFile) {
    if (disabled) return;
    if (!nextFile) return;
    if (nextFile.size === 0) return onError('O arquivo está vazio.');
    if (nextFile.size > policy.maxFileSizeBytes) return onError('A imagem deve ter no máximo 10 MB.');
    if (!policy.allowedMimeTypes.includes(nextFile.type)) return onError('Use uma imagem JPG, PNG ou WebP.');
    onFileChange(nextFile);
  }

  return (
    <SectionCard eyebrow="Etapa 02" title="Envie a roupa superior" description="Use uma fotografia nítida da peça enviada pelo fornecedor.">
      {file && previewUrl ? (
        <div className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${disabled ? 'opacity-70' : ''}`} aria-busy={disabled}>
          <div
            className="relative min-h-[260px] max-h-[430px] overflow-hidden bg-slate-100"
            style={{ aspectRatio: assessment?.inspection?.width && assessment?.inspection?.height ? `${assessment.inspection.width} / ${assessment.inspection.height}` : '4 / 5' }}
          >
            <img src={previewUrl} alt="Preview da roupa enviada" onError={onPreviewError} className="h-full w-full object-contain" />
            <button type="button" disabled={disabled} onClick={() => !disabled && onFileChange(null)} className="absolute right-3 top-3 rounded-full bg-slate-950/80 p-2 text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Remover roupa">
              <X size={15} />
            </button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <FileImage size={17} className="text-slate-400" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800">{file.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{formatBytes(file.size)} · {file.type || 'MIME não informado'}</p>
            </div>
            <button type="button" disabled={disabled} onClick={() => !disabled && inputRef.current?.click()} className="ml-auto text-xs font-semibold text-slate-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:text-slate-400">Substituir</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => !disabled && setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}
          className={`flex min-h-[255px] w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition disabled:cursor-not-allowed disabled:opacity-70 ${dragging ? 'border-slate-950 bg-slate-100' : 'border-slate-300 bg-slate-50/70 hover:border-slate-500 hover:bg-slate-50'}`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm"><UploadCloud size={20} /></span>
          <span className="mt-4 text-sm font-semibold text-slate-800">Arraste a imagem da roupa aqui</span>
          <span className="mt-1 text-xs text-slate-500">ou clique para selecionar · JPEG, PNG ou WebP · até 10 MB</span>
        </button>
      )}
      <input ref={inputRef} type="file" disabled={disabled} accept={policy.allowedMimeTypes.join(',')} className="hidden" onChange={(event) => { const nextFile = event.target.files?.[0]; event.target.value = ''; acceptFile(nextFile); }} />
      <ImageRequirements policy={policy} />
      {inspecting && <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600"><Loader2 size={14} className="animate-spin" /> Validando bytes, dimensões e orientação…</p>}
      {assessment && !inspecting && <TechnicalAssessment assessment={assessment} />}
      {error && !assessment && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
    </SectionCard>
  );
}

function ImageRequirements({ policy }) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs leading-5 text-slate-600">
      <p className="font-semibold text-slate-800">Para melhor fidelidade</p>
      <p className="mt-1">Fotografe a peça de frente e inteira, com gola e mangas visíveis, fundo neutro e boa luz. Evite arquivos comprimidos pelo WhatsApp; logos, estampas e costuras devem estar legíveis.</p>
      <p className="mt-2 text-[11px] text-slate-500">Mínimo técnico: {policy.garment.minWidth}×{policy.garment.minHeight}, {policy.garment.minPixels / 1_000_000} MP · avaliação visual de nitidez e logo continua sendo manual.</p>
    </div>
  );
}

function TechnicalAssessment({ assessment }) {
  const inspection = assessment.inspection;
  const statusClass = assessment.valid
    ? assessment.warnings.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-rose-200 bg-rose-50 text-rose-800';
  const StatusIcon = assessment.valid ? assessment.warnings.length ? AlertTriangle : CheckCircle2 : AlertTriangle;

  return (
    <div className={`mt-3 rounded-xl border p-4 ${statusClass}`} data-testid="garment-assessment">
      <div className="flex items-center gap-2 text-xs font-semibold"><StatusIcon size={15} /> Qualidade técnica: {assessment.qualityLabel}</div>
      {inspection && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          <div><dt className="opacity-70">Dimensões</dt><dd className="font-semibold">{inspection.width || '—'}×{inspection.height || '—'}</dd></div>
          <div><dt className="opacity-70">Proporção real</dt><dd className="font-semibold">{formatRatio(inspection.aspectRatio)}</dd></div>
          <div><dt className="opacity-70">Formato real</dt><dd className="font-semibold">{inspection.format?.toUpperCase() || 'Não identificado'}</dd></div>
          <div><dt className="opacity-70">Tamanho</dt><dd className="font-semibold">{formatBytes(inspection.sizeBytes)}</dd></div>
          <div className="col-span-2"><dt className="opacity-70">Orientação</dt><dd className="font-semibold">{inspection.orientation?.label || 'Não identificada'}</dd></div>
        </dl>
      )}
      {[...assessment.errors, ...assessment.warnings].map((item) => (
        <p key={item.code} className="mt-2 flex gap-2 text-[11px] leading-4"><Info size={13} className="mt-0.5 shrink-0" /> {item.message}</p>
      ))}
    </div>
  );
}
