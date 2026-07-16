import { ShieldCheck } from 'lucide-react';
import SectionCard from '../../../components/ui/SectionCard.jsx';

export default function CreditConfirmation({ checked, disabled, onChange }) {
  return (
    <SectionCard eyebrow="Confirmação" title="Geração paga" description="A chamada usa créditos reais da chave configurada no OpenRouter.">
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${checked ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-400'} ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-slate-950" />
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ShieldCheck size={15} /> Confirmo o uso de créditos do OpenRouter.</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">Uma geração será executada somente depois desta confirmação.</span>
        </span>
      </label>
    </SectionCard>
  );
}
