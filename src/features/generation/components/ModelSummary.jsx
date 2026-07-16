import { ImageIcon, Ratio, Sparkles } from 'lucide-react';
import SectionCard from '../../../components/ui/SectionCard.jsx';

export default function ModelSummary({ config }) {
  return (
    <SectionCard eyebrow="Etapa 03" title="Configuração fixa" description="A primeira fase usa uma única configuração para medir a qualidade com consistência.">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white"><Sparkles size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{config.model?.label || 'Nano Banana 2 Lite'}</p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">{config.model?.providerModel || 'google/gemini-3.1-flash-lite-image'}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"><ImageIcon size={13} /> {config.fixedGeneration.resolution}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"><Ratio size={13} /> {config.fixedGeneration.aspectRatio}</span>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Escopo atual: troca somente de roupas superiores, preservando modelo, pose, ambiente e enquadramento.</p>
      {config.fixedGeneration.aspectRatioActivation?.status === 'blocked' && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">4:5 preparado, mas bloqueado: {config.fixedGeneration.aspectRatioActivation.reason}</p>
      )}
    </SectionCard>
  );
}
