import { BadgeCheck, CheckCircle2, Images, ImagePlus, Layers3, LayoutGrid, Megaphone, Settings2, ShieldAlert, Sparkles } from 'lucide-react';

export default function Sidebar({ keyConfigured, activeView = 'generation', onNavigate, onOpenSettings }) {
  return (
    <aside className="flex w-full shrink-0 flex-col bg-[#0c0c0e] p-5 text-white sm:min-h-screen sm:w-[260px] sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-950 shadow-lg shadow-black/20">
          <Sparkles size={17} />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em]">PRIME IA</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Studio local</p>
        </div>
      </div>

      <nav className="mt-7 space-y-1 sm:mt-10" aria-label="Navegação principal">
        <button type="button" onClick={() => onNavigate?.('generation')} aria-current={activeView === 'generation' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeView === 'generation' ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'}`}>
          <ImagePlus size={17} className="text-slate-300" />
          Nova geração
        </button>
        <button type="button" onClick={() => onNavigate?.('templates')} aria-current={activeView === 'templates' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeView === 'templates' ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'}`}>
          <LayoutGrid size={17} />
          Templates
        </button>
        <button type="button" onClick={() => onNavigate?.('results')} aria-current={activeView === 'results' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeView === 'results' ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'}`}>
          <Images size={17} />
          Resultados
        </button>
        <button type="button" onClick={() => onNavigate?.('batches')} aria-current={activeView === 'batches' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeView === 'batches' ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'}`}>
          <Layers3 size={17} />
          Produção em Lotes
        </button>
        <button type="button" onClick={() => onNavigate?.('branding')} aria-current={activeView === 'branding' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeView === 'branding' ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'}`}>
          <BadgeCheck size={17} />
          Branding
        </button>
        <button type="button" onClick={() => onNavigate?.('marketing')} aria-current={activeView === 'marketing' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeView === 'marketing' ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'}`}>
          <Megaphone size={17} />
          Marketing Studio
        </button>
        <button type="button" onClick={onOpenSettings} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-400 transition hover:bg-white/[0.07] hover:text-white">
          <Settings2 size={17} />
          Configurações
        </button>
      </nav>

      <div className="mt-8 sm:mt-auto sm:pt-12">
        <div className="space-y-3 border-t border-white/10 pt-5 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            {keyConfigured ? <CheckCircle2 size={15} className="text-emerald-400" /> : <ShieldAlert size={15} className="text-amber-400" />}
            {keyConfigured ? 'Chave configurada' : 'Chave não configurada'}
          </div>
          <p className="leading-5 text-slate-500">Execução local — arquivos salvos neste computador.</p>
        </div>
      </div>
    </aside>
  );
}
