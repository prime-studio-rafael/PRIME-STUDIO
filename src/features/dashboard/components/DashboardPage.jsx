import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Boxes, CheckCircle2, ChevronRight, Clock3, Database, FileImage, GalleryVerticalEnd, ImagePlus, Layers3, Loader2, Megaphone, Plus, Sparkles, WandSparkles } from 'lucide-react';
import SectionCard from '../../../components/ui/SectionCard.jsx';
import { getApprovalRate, getDashboardMetrics, getInsights, getMarketingDistributions, getModelDistribution, getProductionSeries, presentModelLabel } from '../dashboardMetrics.js';

const PERIODS = ['Hoje', '7 dias', '30 dias'];


const quickActions = [
  { label: 'Nova Produção', description: 'Gerar uma imagem', icon: ImagePlus, view: 'generation' },
  { label: 'Produção em Lotes', description: 'Organizar volumes', icon: Layers3, view: 'batches' },
  { label: 'Resultados', description: 'Revisar entregas', icon: FileImage, view: 'results' },
  { label: 'Templates', description: 'Gerenciar modelos', icon: Boxes, view: 'templates' },
  { label: 'Branding', description: 'Logos e aplicação', icon: Sparkles, view: 'branding' },
  { label: 'Story Composer', description: 'Criar Story 9:16', icon: Megaphone, view: 'marketing' },
];

function formatDuration(durationMs) { return Number.isFinite(durationMs) ? `${(durationMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : 'Sem gerações no período'; }

function DashboardSkeleton() {
  return <div aria-label="Carregando dashboard" className="space-y-6 animate-pulse"><div className="h-32 rounded-3xl bg-slate-200/80"/><div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-slate-200/70"/>)}</div><div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]"><div className="h-80 rounded-3xl bg-slate-200/70"/><div className="h-80 rounded-3xl bg-slate-200/70"/></div></div>;
}

function MetricCard({ label, value, valueTitle, detail, accent = 'text-slate-950', icon: Icon }) {
  return <SectionCard className="min-h-[142px] p-5 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p title={valueTitle} className={`mt-3 break-words text-2xl font-semibold tracking-[-0.05em] ${accent}`}>{value}</p><p className="mt-2 text-xs text-slate-400">{detail}</p></div><span className="rounded-xl bg-slate-50 p-2.5 text-slate-500"><Icon size={17}/></span></div></SectionCard>;
}

function Donut({ label, distribution, empty }) {
  if (!distribution.total) return <SectionCard className="p-5"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-6 text-sm leading-6 text-slate-500">{empty}</p></SectionCard>;
  const colors = ['#0f172a', '#64748b', '#a5b4fc', '#cbd5e1']; let cursor = 0;
  const segments = distribution.items.slice(0, 4).map((item, index) => { const next = cursor + item.percentage; const segment = `${colors[index]} ${cursor}% ${next}%`; cursor = next; return segment; });
  const primary = distribution.items[0];
  return <SectionCard className="p-5"><p className="text-xs font-medium text-slate-500">{label}</p><div className="mt-5 flex items-center gap-5"><div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${segments.join(', ')})` }}><div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-white text-center"><span className="text-lg font-semibold tracking-[-0.05em] text-slate-950">{primary.percentage}%</span></div></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900" title={primary.technical || undefined}>{primary.label}</p><div className="mt-3 space-y-1.5">{distribution.items.slice(0, 4).map((item, index) => <div key={item.label} className="flex items-center justify-between gap-4 text-[11px] text-slate-500"><span className="flex min-w-0 items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colors[index] }}/><span className="truncate">{item.label}</span></span><span>{item.percentage}%</span></div>)}</div></div></div></SectionCard>;
}

function ProductionChart({ points }) {
  const max = Math.max(...points.map((point) => point.value), 1); const denominator = Math.max(points.length - 1, 1);
  const mapped = points.map((point, index) => ({ ...point, x: (index / denominator) * 100, y: 100 - (point.value / max) * 82 - 8 })); const line = mapped.map((point) => `${point.x},${point.y}`).join(' ');
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-56 w-full overflow-visible" role="img" aria-label="Produção por dia"><defs><linearGradient id="production-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0f172a" stopOpacity="0.16"/><stop offset="100%" stopColor="#0f172a" stopOpacity="0"/></linearGradient></defs><path d={`M 0,100 L ${line} L 100,100 Z`} fill="url(#production-fill)"/><polyline points={line} fill="none" stroke="#0f172a" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>{mapped.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r="2.3" fill="white" stroke="#0f172a" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}</svg>;
}

function formatUsd(value) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value); }
function formatBrl(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value); }
function convertUsdToBrl(costUsd, usdToBrlRate) {
  if (!Number.isFinite(costUsd) || !Number.isFinite(usdToBrlRate)) return null;
  return Math.round((costUsd * usdToBrlRate + Number.EPSILON) * 100) / 100;
}

export default function DashboardPage({ onNavigate, usdToBrlRate, quoteStatus = 'ready', results = [], resultsStatus = 'idle', resultsError = '', batches = [], batchesStatus = 'idle', batchesError = '', keyConfigured = false, operations = {}, now = new Date() }) {
  const [period, setPeriod] = useState('Hoje');
  const [loading, setLoading] = useState(true);
  const metrics = useMemo(() => getDashboardMetrics({ results, batches, period, now }), [results, batches, period, now]);
  const production = useMemo(() => getProductionSeries({ results, period, now }), [results, period, now]);
  const models = useMemo(() => getModelDistribution({ results, period, now }), [results, period, now]);
  const approvalRate = useMemo(() => getApprovalRate({ results, period, now }), [results, period, now]);
  const marketingDistributions = useMemo(() => getMarketingDistributions(operations.weeks || []), [operations.weeks]);
  const costUsd = metrics.costUsd;
  const validRate = Number.isFinite(usdToBrlRate) && usdToBrlRate > 0;
  const costBrl = validRate ? convertUsdToBrl(costUsd, usdToBrlRate) : null;
  const brlValue = quoteStatus === 'loading' ? 'Carregando…' : quoteStatus === 'error' ? 'Cotação indisponível' : costUsd === null ? 'Sem custos' : costBrl === null ? 'Cotação ausente' : formatBrl(costBrl);
  const brlDetail = quoteStatus === 'loading' ? 'Lendo configuração local' : quoteStatus === 'error' ? 'Não foi possível ler a cotação local' : costUsd === null ? 'Sem custos registrados no período' : costBrl === null ? 'Defina a cotação local em Configurações' : `US$ 1 = ${formatBrl(usdToBrlRate)}`;

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 360);
    return () => window.clearTimeout(timer);
  }, []);

  function choosePeriod(nextPeriod) {
    setPeriod(nextPeriod);
    setLoading(true);
    window.setTimeout(() => setLoading(false), 220);
  }

  const operationalLoading = resultsStatus === 'loading' || batchesStatus === 'loading';
  const health = buildHealth({ ...operations, keyConfigured });
  const insights = getInsights(metrics);

  if (loading) return <DashboardSkeleton/>;

  return <div className="space-y-8 pb-6">
    <section aria-labelledby="dashboard-executive" className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:px-8 sm:py-8">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-slate-100/90 blur-3xl"/>
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"><Sparkles size={13} className="text-slate-700"/> Operations Center</div><h1 id="dashboard-executive" className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">Bom dia, Rafael.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Acompanhe a produção, os custos e os próximos movimentos da operação em um só lugar.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Período do dashboard">{PERIODS.map((item) => <button key={item} type="button" onClick={() => choosePeriod(item)} aria-pressed={period === item} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === item ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}>{item}</button>)}</div><button type="button" onClick={() => onNavigate?.('generation')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"><Plus size={16}/> Nova Produção</button></div></div>
        <div className="relative mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Resumo da produção</p><p className="mt-1 text-sm font-semibold text-slate-900">{metrics.generatedCount} imagens geradas</p></div><div><p className="text-xs text-slate-400">Resultados prontos</p><p className="mt-1 text-sm font-semibold text-slate-900">{metrics.readyResults} aprovadas · {metrics.pendingResults} em revisão</p></div><div><p className="text-xs text-slate-400">Base de leitura</p><p className="mt-1 text-sm font-semibold text-slate-900">{period === 'Hoje' ? 'Dados locais de hoje' : `Dados locais dos últimos ${period}`}</p></div></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Imagens geradas" value={String(metrics.generatedCount)} detail="Neste período" icon={FileImage}/><MetricCard label="Tempo médio" value={formatDuration(metrics.averageDurationMs)} detail={metrics.averageDurationMs === null ? 'Sem dados suficientes' : 'Por geração concluída'} icon={Clock3}/><MetricCard label="IA principal" value={metrics.mainModel ? presentModelLabel(metrics.mainModel) : 'Nenhum modelo utilizado no período'} valueTitle={metrics.mainModel || undefined} detail={metrics.mainModel ? 'Mais usada no período' : 'Aguardando uma geração com modelo informado'} icon={Sparkles}/><MetricCard label="Lotes ativos" value={String(metrics.activeBatches.length)} detail={`${metrics.completedBatches.length} concluído(s) · ${metrics.queueItems} na fila`} icon={Layers3}/></div>
      <div className="grid gap-4 lg:grid-cols-3"><MetricCard label="Custo em dólar" value={costUsd === null ? 'Não informado' : formatUsd(costUsd)} detail={costUsd === null ? 'Sem custos registrados no período' : `${metrics.costSampleCount} custo(s) registrado(s)`} accent="text-emerald-700" icon={ArrowUpRight}/><MetricCard label="Custo total em reais" value={brlValue} detail={brlDetail} accent="text-emerald-700" icon={ArrowUpRight}/><MetricCard label="Taxa de aprovação" value={approvalRate.percentage === null ? 'Não informado' : `${approvalRate.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} detail={approvalRate.percentage === null ? 'Sem revisões concluídas para calcular a taxa' : `${approvalRate.approved} aprovada(s) em ${approvalRate.completed} revisão(ões)`} accent="text-slate-600" icon={CheckCircle2}/></div>
    </section>

    <section aria-labelledby="dashboard-production" className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Produção</p><h2 id="dashboard-production" className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-950">Ritmo e fluxo da operação</h2></div><div className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)_minmax(300px,0.85fr)]"><SectionCard title="Produção por dia" description="Resultados locais agrupados pelo período selecionado.">{production.hasData ? <div className="mt-2"><ProductionChart points={production.points}/><div className="mt-2 grid text-center text-[10px] font-medium uppercase tracking-wide text-slate-400" style={{ gridTemplateColumns: `repeat(${production.points.length}, minmax(0, 1fr))` }}>{production.points.map((point) => <span key={point.key}>{point.label}</span>)}</div></div> : <p className="mt-6 text-sm text-slate-500">Ainda não há produções neste período.</p>}</SectionCard><SectionCard title="Produções recentes" description="Resultados locais mais recentes.">{resultsStatus === 'error' ? <p role="alert" className="mt-6 text-sm text-rose-700">{resultsError || 'Não foi possível carregar os resultados locais.'}</p> : operationalLoading && metrics.recent.length === 0 ? <div className="flex min-h-40 items-center justify-center text-sm text-slate-400"><Loader2 className="animate-spin" size={18}/></div> : metrics.recent.length ? <ol className="mt-1 divide-y divide-slate-100">{metrics.recent.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-center gap-3 py-3 first:pt-1" title={item.absoluteTime}><span className={`h-2 w-2 shrink-0 rounded-full ${item.tone === 'emerald' ? 'bg-emerald-500' : item.tone === 'amber' ? 'bg-amber-400' : item.tone === 'rose' ? 'bg-rose-500' : 'bg-slate-300'}`}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{item.name}</p><p className="mt-0.5 text-xs text-slate-400">{item.time}</p></div><span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">{item.label}</span></li>)}</ol> : <p className="mt-6 text-sm text-slate-500">Nenhuma produção local registrada ainda.</p>}<button type="button" onClick={() => onNavigate?.('results')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950">Ver resultados <ChevronRight size={14}/></button></SectionCard><SectionCard title="Fila em andamento" description="Lotes locais ativos e seus itens pendentes.">{batchesStatus === 'error' ? <p role="alert" className="mt-6 text-sm text-rose-700">{batchesError || 'Não foi possível carregar os lotes locais.'}</p> : metrics.activeBatches.length ? <div className="space-y-3">{metrics.activeBatches.map((batch) => { const finished = (batch.completedItems || 0) + (batch.failedItems || 0) + (batch.cancelledItems || 0) + (batch.interruptedItems || 0); const progress = batch.totalItems ? Math.round((finished / batch.totalItems) * 100) : 0; return <article key={batch.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{batch.name}</p><p className="mt-1 text-xs text-slate-500">{finished} concluído(s) · {Math.max(0, batch.totalItems - finished)} aguardando</p></div><span className="shrink-0 text-xs font-semibold text-slate-700">{batch.totalItems} imagens</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${progress}%` }}/></div></article>; })}</div> : <p className="mt-6 text-sm text-slate-500">Nenhum lote local ativo no momento.</p>}<button type="button" onClick={() => onNavigate?.('batches')} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-950">Abrir Produção em Lotes <ArrowRight size={14}/></button></SectionCard></div></section>

    <section aria-labelledby="dashboard-reliability" className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Confiabilidade</p><h2 id="dashboard-reliability" className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-950">Saúde da operação</h2></div><p className="text-xs text-slate-400">Estados locais de configuração e disponibilidade.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{health.map(({ label, detail, icon: Icon, status, tone }) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start justify-between"><span className="rounded-xl bg-white p-2 text-slate-600 shadow-sm"><Icon size={16}/></span><span className={`h-2 w-2 rounded-full ${tone === 'emerald' ? 'bg-emerald-500' : tone === 'sky' ? 'bg-sky-500' : tone === 'amber' ? 'bg-amber-400' : tone === 'rose' ? 'bg-rose-500' : 'bg-slate-300'}`}/></div><p className="mt-4 text-sm font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p><p className="mt-3 text-[11px] font-semibold text-slate-600">{status}</p></div>)}</div></section>

    <section aria-labelledby="dashboard-intelligence" className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Inteligência operacional</p><h2 id="dashboard-intelligence" className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-950">Leituras e próximos passos</h2></div><div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><SectionCard title="Insights" description="Leituras determinísticas, sem chamada de IA."><div className="space-y-3">{insights.map((text) => <Insight key={text} text={text}/>)}</div></SectionCard><SectionCard title="Ações rápidas" description="Comece o próximo passo da sua operação."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{quickActions.map(({ label, description, icon: Icon, view }) => <button key={label} type="button" onClick={() => onNavigate?.(view)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"><span className="rounded-xl bg-slate-950 p-2.5 text-white"><Icon size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span><ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700"/></button>)}</div></SectionCard></div></section>

    <section aria-label="Distribuições reais" className="border-t border-slate-100 pt-6"><div className="mb-3"><p className="text-xs text-slate-400">Distribuições calculadas exclusivamente a partir de Resultados e Stories locais.</p></div><div className="grid gap-4 lg:grid-cols-3"><Donut label="Estilos visuais" distribution={marketingDistributions.styles} empty="Crie Stories para visualizar os estilos mais usados."/><Donut label="Tipografia" distribution={marketingDistributions.typography} empty="Crie Stories para visualizar as tipografias mais usadas."/><Donut label="Modelos de geração" distribution={models} empty="Nenhum modelo informado nos Resultados deste período."/></div></section>
  </div>;
}

function Insight({ text }) {
  return <div className="flex gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-4"><span className="rounded-xl bg-white p-2 text-violet-600 shadow-sm"><Sparkles size={15}/></span><p className="pt-1 text-sm leading-5 text-slate-700">{text}</p></div>;
}

export { DashboardSkeleton };
export { formatUsd, formatBrl, convertUsdToBrl };
export { getDashboardMetrics, getInsights } from '../dashboardMetrics.js';

function buildHealth({ health, branding, providers, keyConfigured }) {
  const state = health?.status === 'ready' ? health.data : null;
  const localState = (value) => value === 'available' ? ['Disponível', 'Verificação local aprovada', 'emerald'] : value === 'unavailable' ? ['Indisponível', 'Verificação local indisponível', 'rose'] : ['Não foi possível verificar', 'Leitura local indisponível', 'slate'];
  const [storageStatus, storageDetail, storageTone] = localState(state?.storage?.status);
  const [rendererStatus, rendererDetail, rendererTone] = localState(state?.renderer?.status);
  const primary = branding?.data?.approved; const white = branding?.data?.variants?.white?.approved;
  const brandingValue = branding?.status === 'error' ? ['Não foi possível verificar', 'Falha ao ler a configuração local', 'slate'] : !primary ? ['Ausente', 'Nenhuma logo principal aprovada', 'amber'] : branding.data?.config?.enabled && white ? ['Configurado', 'Logo principal, branca e aplicação ativa', 'emerald'] : ['Parcial', white ? 'Logo aprovada; aplicação automática desativada' : 'Logo branca ainda não foi aprovada', 'amber'];
  const deepseek = providers?.data?.providers?.find((provider) => provider.provider === 'deepseek');
  const deepseekValue = providers?.status === 'error' ? ['Não foi possível verificar', 'Falha ao ler a configuração local', 'slate'] : !deepseek?.configured ? ['Não configurado', 'Nenhuma chave DeepSeek salva', 'amber'] : deepseek.lastTestStatus === 'success' ? ['Configurado', `${deepseek.modelLabel} · último teste aprovado`, 'emerald'] : deepseek.lastTestStatus === 'failed' ? ['Configurado', `${deepseek.modelLabel} · último teste falhou`, 'amber'] : ['Configurado', `${deepseek.modelLabel} · nunca testado`, 'sky'];
  return [{ label: 'Storage', detail: storageDetail, icon: Database, status: storageStatus, tone: storageTone }, { label: 'Renderer', detail: rendererDetail, icon: WandSparkles, status: rendererStatus, tone: rendererTone }, { label: 'Branding', detail: brandingValue[1], icon: Sparkles, status: brandingValue[0], tone: brandingValue[2] }, { label: 'DeepSeek', detail: deepseekValue[1], icon: Activity, status: deepseekValue[0], tone: deepseekValue[2] }, { label: 'OpenRouter', detail: keyConfigured ? 'Chave local configurada' : 'Chave local não configurada', icon: GalleryVerticalEnd, status: keyConfigured ? 'Chave configurada' : 'Não configurado', tone: keyConfigured ? 'sky' : 'amber' }];
}
