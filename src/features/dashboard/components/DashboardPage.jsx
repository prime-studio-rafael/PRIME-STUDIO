import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Boxes, CheckCircle2, ChevronRight, Clock3, Database, FileImage, GalleryVerticalEnd, ImagePlus, Layers3, Loader2, Megaphone, Plus, Sparkles, WandSparkles } from 'lucide-react';
import SectionCard from '../../../components/ui/SectionCard.jsx';

const PERIODS = ['Hoje', '7 dias', '30 dias'];

const PERIOD_DATA = {
  Hoje: { images: '42', average: '8,4 s', cost: 'US$ 1,43', batches: '2', success: '98,2%', chart: [18, 27, 23, 36, 31, 47, 42] },
  '7 dias': { images: '286', average: '8,1 s', cost: 'US$ 9,72', batches: '6', success: '97,8%', chart: [32, 45, 39, 61, 55, 72, 68] },
  '30 dias': { images: '1.148', average: '8,3 s', cost: 'US$ 39,03', batches: '14', success: '98,0%', chart: [57, 73, 65, 91, 85, 108, 102] },
};

const recentProductions = [
  { name: 'Camisa Premium · Azul', time: 'há 4 min', status: 'Concluída', tone: 'emerald' },
  { name: 'Tênis EA7 · Story', time: 'há 12 min', status: 'Em revisão', tone: 'amber' },
  { name: 'Coleção Inverno · Lote', time: 'há 26 min', status: 'Concluída', tone: 'emerald' },
  { name: 'Jaqueta Essential · Story', time: 'há 41 min', status: 'Pronta', tone: 'sky' },
];

const distributions = [
  { label: 'Estilos visuais', value: 'Premium', percentage: 46, color: '#0f172a', segments: ['#0f172a 0 46%', '#64748b 46% 73%', '#cbd5e1 73% 100%'], legend: [['Premium', '46%'], ['Luxury', '27%'], ['Outros', '27%']] },
  { label: 'Tipografia', value: 'Manrope', percentage: 58, color: '#5b5bd6', segments: ['#5b5bd6 0 58%', '#a5b4fc 58% 82%', '#e0e7ff 82% 100%'], legend: [['Manrope', '58%'], ['Inter', '24%'], ['Outras', '18%']] },
  { label: 'IA utilizada', value: 'Nano Banana', percentage: 100, color: '#059669', segments: ['#059669 0 82%', '#86efac 82% 100%'], legend: [['Nano Banana', '82%'], ['DeepSeek', '18%']] },
];

const health = [
  { label: 'Storage', detail: '42,8 GB disponíveis', icon: Database, status: 'Operacional', tone: 'emerald' },
  { label: 'Renderer', detail: 'Sharp · pronto', icon: WandSparkles, status: 'Operacional', tone: 'emerald' },
  { label: 'Branding', detail: '2 logos aprovadas', icon: Sparkles, status: 'Configurado', tone: 'sky' },
  { label: 'DeepSeek', detail: 'Textos para Stories', icon: Activity, status: 'Configurada', tone: 'violet' },
  { label: 'OpenRouter', detail: 'Imagem · 1K', icon: GalleryVerticalEnd, status: 'Configurado', tone: 'sky' },
];

const queue = [
  { title: 'Coleção Alphaville', count: '12 imagens', progress: 72, detail: '9 concluídas · 3 aguardando', tone: 'bg-indigo-500' },
  { title: 'Stories da semana', count: '8 Stories', progress: 50, detail: '4 prontos · 4 em composição', tone: 'bg-slate-900' },
  { title: 'Lookbook masculino', count: '6 imagens', progress: 16, detail: '1 concluída · 5 na fila', tone: 'bg-emerald-500' },
];

const quickActions = [
  { label: 'Nova Produção', description: 'Gerar uma imagem', icon: ImagePlus, view: 'generation' },
  { label: 'Produção em Lotes', description: 'Organizar volumes', icon: Layers3, view: 'batches' },
  { label: 'Resultados', description: 'Revisar entregas', icon: FileImage, view: 'results' },
  { label: 'Templates', description: 'Gerenciar modelos', icon: Boxes, view: 'templates' },
  { label: 'Branding', description: 'Logos e aplicação', icon: Sparkles, view: 'branding' },
  { label: 'Story Composer', description: 'Criar Story 9:16', icon: Megaphone, view: 'marketing' },
];

function mockLabel(period) {
  return period === 'Hoje' ? 'dados demonstrativos do dia' : `dados demonstrativos dos últimos ${period}`;
}

function DashboardSkeleton() {
  return <div aria-label="Carregando dashboard" className="space-y-6 animate-pulse"><div className="h-32 rounded-3xl bg-slate-200/80"/><div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-slate-200/70"/>)}</div><div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]"><div className="h-80 rounded-3xl bg-slate-200/70"/><div className="h-80 rounded-3xl bg-slate-200/70"/></div></div>;
}

function MetricCard({ label, value, detail, accent = 'text-slate-950', icon: Icon }) {
  return <SectionCard className="min-h-[142px] p-5 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-3 text-2xl font-semibold tracking-[-0.05em] ${accent}`}>{value}</p><p className="mt-2 text-xs text-slate-400">{detail}</p></div><span className="rounded-xl bg-slate-50 p-2.5 text-slate-500"><Icon size={17}/></span></div></SectionCard>;
}

function Donut({ item }) {
  return <SectionCard className="p-5"><p className="text-xs font-medium text-slate-500">{item.label}</p><div className="mt-5 flex items-center gap-5"><div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${item.segments.join(', ')})` }}><div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-white text-center"><span className="text-lg font-semibold tracking-[-0.05em] text-slate-950">{item.percentage}%</span></div></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.value}</p><div className="mt-3 space-y-1.5">{item.legend.map(([label, value], index) => <div key={label} className="flex items-center justify-between gap-4 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: index === 0 ? item.color : index === 1 ? '#94a3b8' : '#cbd5e1' }}/>{label}</span><span>{value}</span></div>)}</div></div></div></SectionCard>;
}

function ProductionChart({ values }) {
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${100 - (value / Math.max(...values)) * 82 - 8}`).join(' ');
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-56 w-full overflow-visible" role="img" aria-label="Produção por dia, dados demonstrativos"><defs><linearGradient id="production-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0f172a" stopOpacity="0.16"/><stop offset="100%" stopColor="#0f172a" stopOpacity="0"/></linearGradient></defs><path d={`M 0,100 L ${points} L 100,100 Z`} fill="url(#production-fill)"/><polyline points={points} fill="none" stroke="#0f172a" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>{values.map((value, index) => <circle key={index} cx={(index / (values.length - 1)) * 100} cy={100 - (value / Math.max(...values)) * 82 - 8} r="2.3" fill="white" stroke="#0f172a" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}</svg>;
}

function formatUsd(value) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value); }
function formatBrl(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value); }
function convertUsdToBrl(costUsd, usdToBrlRate) {
  const usdCents = Math.round(costUsd * 100);
  const rateUnits = Math.round(usdToBrlRate * 10_000);
  return Math.round((usdCents * rateUnits) / 10_000) / 100;
}

export default function DashboardPage({ onNavigate, usdToBrlRate, quoteStatus = 'ready' }) {
  const [period, setPeriod] = useState('Hoje');
  const [loading, setLoading] = useState(true);
  const data = useMemo(() => PERIOD_DATA[period], [period]);
  const costUsd = Number(data.cost.replace(/[^0-9,]/g, '').replace(',', '.'));
  const validRate = Number.isFinite(usdToBrlRate) && usdToBrlRate > 0;
  const costBrl = validRate ? convertUsdToBrl(costUsd, usdToBrlRate) : null;
  const brlValue = quoteStatus === 'loading' ? 'Carregando…' : costBrl === null ? 'Não informado' : formatBrl(costBrl);
  const brlDetail = quoteStatus === 'loading' ? 'Lendo configuração local' : quoteStatus === 'error' ? 'Não foi possível ler a cotação local' : costBrl === null ? 'Configure uma cotação válida' : `Cotação usada: ${formatBrl(usdToBrlRate)}`;

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 360);
    return () => window.clearTimeout(timer);
  }, []);

  function choosePeriod(nextPeriod) {
    setPeriod(nextPeriod);
    setLoading(true);
    window.setTimeout(() => setLoading(false), 220);
  }

  if (loading) return <DashboardSkeleton/>;

  return <div className="space-y-6 pb-6">
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:px-8 sm:py-8">
      <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-slate-100/90 blur-3xl"/>
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"><Sparkles size={13} className="text-slate-700"/> PRIME IA STUDIO</div><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">Bom dia, Rafael.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Sua operação está organizada para transformar produtos em imagens e Stories prontos para vender.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Período do dashboard">{PERIODS.map((item) => <button key={item} type="button" onClick={() => choosePeriod(item)} aria-pressed={period === item} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === item ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}>{item}</button>)}</div><button type="button" onClick={() => onNavigate?.('generation')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"><Plus size={16}/> Nova Produção</button></div></div>
      <div className="relative mt-7 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Resumo da produção</p><p className="mt-1 text-sm font-semibold text-slate-900">{data.images} imagens entregues</p></div><div><p className="text-xs text-slate-400">Ritmo atual</p><p className="mt-1 text-sm font-semibold text-slate-900">{data.success} de sucesso</p></div><div><p className="text-xs text-slate-400">Base de leitura</p><p className="mt-1 text-sm font-semibold text-slate-900">{mockLabel(period)}</p></div></div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"><MetricCard label="Imagens geradas" value={data.images} detail="Neste período" icon={FileImage}/><MetricCard label="Tempo médio" value={data.average} detail="Por geração" icon={Clock3}/><MetricCard label="IA principal" value="Nano Banana" detail="Flash Lite Image" icon={Sparkles}/><MetricCard label="Custo em dólar" value={formatUsd(costUsd)} detail="Valor original · mock" accent="text-emerald-700" icon={ArrowUpRight}/><MetricCard label="Custo total em reais" value={brlValue} detail={brlDetail} accent="text-emerald-700" icon={ArrowUpRight}/><MetricCard label="Lotes ativos" value={data.batches} detail="Em produção" icon={Layers3}/><MetricCard label="Taxa de sucesso" value={data.success} detail="Operação estável" accent="text-emerald-700" icon={CheckCircle2}/></section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]"><SectionCard eyebrow="Produção" title="Produção por dia" description="Volume demonstrativo da operação selecionada."><div className="mt-2"><ProductionChart values={data.chart}/><div className="mt-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Hoje</span></div></div></SectionCard><SectionCard eyebrow="Atividade" title="Produções recentes" description="Acompanhe as últimas entregas."><ol className="mt-1 divide-y divide-slate-100">{recentProductions.map((item) => <li key={item.name} className="flex items-center gap-3 py-3 first:pt-1"><span className={`h-2 w-2 shrink-0 rounded-full ${item.tone === 'emerald' ? 'bg-emerald-500' : item.tone === 'amber' ? 'bg-amber-400' : 'bg-sky-500'}`}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{item.name}</p><p className="mt-0.5 text-xs text-slate-400">{item.time}</p></div><span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">{item.status}</span></li>)}</ol><button type="button" onClick={() => onNavigate?.('results')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950">Ver resultados <ChevronRight size={14}/></button></SectionCard></section>

    <section className="grid gap-4 lg:grid-cols-3">{distributions.map((item) => <Donut key={item.label} item={item}/>)}</section>

    <SectionCard eyebrow="Saúde da operação" title="Tudo sob controle" description="Estados demonstrativos da sua infraestrutura local."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{health.map(({ label, detail, icon: Icon, status, tone }) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start justify-between"><span className="rounded-xl bg-white p-2 text-slate-600 shadow-sm"><Icon size={16}/></span><span className={`h-2 w-2 rounded-full ${tone === 'emerald' ? 'bg-emerald-500' : tone === 'violet' ? 'bg-violet-500' : 'bg-sky-500'}`}/></div><p className="mt-4 text-sm font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p><p className="mt-3 text-[11px] font-semibold text-slate-600">{status}</p></div>)}</div></SectionCard>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]"><SectionCard eyebrow="Fila" title="Produção em andamento" description="Cards de fila demonstrativos; nenhuma execução está conectada nesta fase."><div className="space-y-3">{queue.map((item) => <article key={item.title} className="rounded-2xl border border-slate-100 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div><span className="text-xs font-semibold text-slate-700">{item.count}</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.tone}`} style={{ width: `${item.progress}%` }}/></div></article>)}</div><button type="button" onClick={() => onNavigate?.('batches')} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-950">Abrir Produção em Lotes <ArrowRight size={14}/></button></SectionCard><SectionCard eyebrow="Inteligência" title="Insights inteligentes" description="Leituras demonstrativas para orientar a operação."><div className="space-y-3"><Insight text="Hoje você produziu 18% mais imagens."/><Insight text="Luxury foi o estilo mais usado."/><Insight text="DeepSeek economizou R$ 3,20."/></div></SectionCard></section>

    <SectionCard eyebrow="Atalhos" title="Ações rápidas" description="Comece o próximo passo da sua operação."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{quickActions.map(({ label, description, icon: Icon, view }) => <button key={label} type="button" onClick={() => onNavigate?.(view)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"><span className="rounded-xl bg-slate-950 p-2.5 text-white"><Icon size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span><ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700"/></button>)}</div></SectionCard>
  </div>;
}

function Insight({ text }) {
  return <div className="flex gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-4"><span className="rounded-xl bg-white p-2 text-violet-600 shadow-sm"><Sparkles size={15}/></span><p className="pt-1 text-sm leading-5 text-slate-700">{text}</p></div>;
}

export { DashboardSkeleton };
export { formatUsd, formatBrl, convertUsdToBrl };
