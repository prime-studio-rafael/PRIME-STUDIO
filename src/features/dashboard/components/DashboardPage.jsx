import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Boxes, CheckCircle2, ChevronRight, Clock3, Database, FileImage, GalleryVerticalEnd, ImagePlus, Layers3, Loader2, Megaphone, Plus, Sparkles, WandSparkles } from 'lucide-react';
import SectionCard from '../../../components/ui/SectionCard.jsx';

const PERIODS = ['Hoje', '7 dias', '30 dias'];

const distributions = [
  { label: 'Estilos visuais', value: 'Premium', percentage: 46, color: '#0f172a', segments: ['#0f172a 0 46%', '#64748b 46% 73%', '#cbd5e1 73% 100%'], legend: [['Premium', '46%'], ['Luxury', '27%'], ['Outros', '27%']] },
  { label: 'Tipografia', value: 'Manrope', percentage: 58, color: '#5b5bd6', segments: ['#5b5bd6 0 58%', '#a5b4fc 58% 82%', '#e0e7ff 82% 100%'], legend: [['Manrope', '58%'], ['Inter', '24%'], ['Outras', '18%']] },
  { label: 'IA utilizada', value: 'Nano Banana', percentage: 100, color: '#059669', segments: ['#059669 0 82%', '#86efac 82% 100%'], legend: [['Nano Banana', '82%'], ['DeepSeek', '18%']] },
];

const quickActions = [
  { label: 'Nova Produção', description: 'Gerar uma imagem', icon: ImagePlus, view: 'generation' },
  { label: 'Produção em Lotes', description: 'Organizar volumes', icon: Layers3, view: 'batches' },
  { label: 'Resultados', description: 'Revisar entregas', icon: FileImage, view: 'results' },
  { label: 'Templates', description: 'Gerenciar modelos', icon: Boxes, view: 'templates' },
  { label: 'Branding', description: 'Logos e aplicação', icon: Sparkles, view: 'branding' },
  { label: 'Story Composer', description: 'Criar Story 9:16', icon: Megaphone, view: 'marketing' },
];

const ACTIVE_BATCH_STATUSES = new Set(['ready', 'running', 'paused', 'interrupted']);
const COMPLETED_BATCH_STATUSES = new Set(['completed', 'completed_with_errors']);
const TERMINAL_ITEM_STATUSES = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const PERIOD_DAYS = { Hoje: 1, '7 dias': 7, '30 dias': 30 };

function startOfDay(value) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function isInPeriod(value, days, now) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return false;
  const start = startOfDay(now);
  start.setDate(start.getDate() - (days - 1));
  return timestamp >= start.getTime() && timestamp <= now.getTime();
}
function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}
function relativeTime(value, now) {
  const parsed = timestamp(value);
  if (parsed === null) return 'Data não informada';
  const minutes = Math.max(0, Math.round((now.getTime() - parsed) / 60_000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}
function resultStatus(result) {
  if (result.reviewStatus === 'approved') return { label: 'Aprovada', tone: 'emerald' };
  if (result.reviewStatus === 'rejected') return { label: 'Reprovada', tone: 'rose' };
  if (result.reviewStatus === 'pending') return { label: 'Em revisão', tone: 'amber' };
  return { label: 'Estado não informado', tone: 'slate' };
}
function formatDuration(durationMs) { return Number.isFinite(durationMs) ? `${(durationMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : 'Não informado'; }
function absoluteDate(value) { const parsed = timestamp(value); return parsed === null ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed); }
function normalizeModel(model) { return typeof model === 'string' ? model.trim().replace(/\s+/g, ' ') : ''; }
function presentModelLabel(model) {
  const normalized = normalizeModel(model);
  if (!normalized.includes('/')) return normalized;
  return normalized.split('/').at(-1).split(/[-_]+/).filter((part) => part && part !== 'image').map((part) => /^\d/.test(part) ? part : `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}
function uniqueResults(results) {
  const seen = new Set();
  return results.filter((result, index) => {
    const key = result?.id ? `id:${result.id}` : `index:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getDashboardMetrics({ results = [], batches = [], period = 'Hoje', now = new Date() } = {}) {
  const unique = uniqueResults(results);
  const periodResults = unique.filter((result) => isInPeriod(result.createdAt, PERIOD_DAYS[period] || 1, now));
  const withDuration = periodResults.filter((result) => Number.isFinite(result.durationMs) && result.durationMs > 0);
  const costResults = periodResults.filter((result) => Number.isFinite(result.costUsd) && result.costUsd >= 0);
  const costUsd = costResults.length ? costResults.reduce((sum, result) => sum + result.costUsd, 0) : null;
  const modelCounts = periodResults.reduce((counts, result) => {
    const label = normalizeModel(result.model);
    if (label) {
      const key = label.toLocaleLowerCase('pt-BR');
      const current = counts.get(key) || { label, count: 0 };
      counts.set(key, { ...current, count: current.count + 1 });
    }
    return counts;
  }, new Map());
  const mainModel = [...modelCounts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))[0]?.label || null;
  const activeBatches = batches.filter((batch) => ACTIVE_BATCH_STATUSES.has(batch.status));
  const completedBatches = batches.filter((batch) => COMPLETED_BATCH_STATUSES.has(batch.status));
  const queueItems = activeBatches.reduce((count, batch) => count + (batch.items || []).filter((item) => !TERMINAL_ITEM_STATUSES.has(item.status)).length, 0);
  const recent = [...unique].sort((a, b) => (timestamp(b.createdAt) || 0) - (timestamp(a.createdAt) || 0)).slice(0, 4).map((result) => ({
    name: result.templateLabel || result.id || 'Produção sem identificação', time: relativeTime(result.createdAt, now), absoluteTime: absoluteDate(result.createdAt), ...resultStatus(result),
  }));
  const previousNow = new Date(now); previousNow.setDate(previousNow.getDate() - 1);
  const todayCount = unique.filter((result) => isInPeriod(result.createdAt, 1, now)).length;
  const yesterdayCount = unique.filter((result) => isInPeriod(result.createdAt, 1, previousNow)).length;
  return {
    periodResults, generatedCount: periodResults.length, averageDurationMs: withDuration.length ? withDuration.reduce((sum, result) => sum + result.durationMs, 0) / withDuration.length : null,
    costUsd, costSampleCount: costResults.length, mainModel, activeBatches, completedBatches, queueItems, recent, todayCount, yesterdayCount,
    pendingResults: periodResults.filter((result) => result.reviewStatus === 'pending').length,
    readyResults: periodResults.filter((result) => result.reviewStatus === 'approved').length,
  };
}

export function getInsights(metrics) {
  const insights = [];
  if (metrics.todayCount > metrics.yesterdayCount) {
    insights.push(`Hoje você produziu ${metrics.todayCount - metrics.yesterdayCount} imagem(ns) a mais que ontem.`);
  } else if (metrics.todayCount && metrics.yesterdayCount) {
    insights.push(`Hoje você produziu ${metrics.todayCount} imagem(ns), em comparação com ${metrics.yesterdayCount} ontem.`);
  } else if (metrics.todayCount) {
    insights.push(`Hoje você produziu ${metrics.todayCount} imagem(ns).`);
  }
  if (metrics.activeBatches.length) insights.push(`${metrics.activeBatches.length} lote(s) seguem ativos, com ${metrics.queueItems} item(ns) pendente(s).`);
  if (metrics.readyResults) insights.push(`${metrics.readyResults} resultado(s) aprovado(s) no período selecionado.`);
  if (!insights.length) insights.push('Ainda não há dados locais suficientes para gerar insights operacionais.');
  return insights.slice(0, 3);
}

function DashboardSkeleton() {
  return <div aria-label="Carregando dashboard" className="space-y-6 animate-pulse"><div className="h-32 rounded-3xl bg-slate-200/80"/><div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-slate-200/70"/>)}</div><div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]"><div className="h-80 rounded-3xl bg-slate-200/70"/><div className="h-80 rounded-3xl bg-slate-200/70"/></div></div>;
}

function MetricCard({ label, value, valueTitle, detail, accent = 'text-slate-950', icon: Icon }) {
  return <SectionCard className="min-h-[142px] p-5 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p title={valueTitle} className={`mt-3 break-words text-2xl font-semibold tracking-[-0.05em] ${accent}`}>{value}</p><p className="mt-2 text-xs text-slate-400">{detail}</p></div><span className="rounded-xl bg-slate-50 p-2.5 text-slate-500"><Icon size={17}/></span></div></SectionCard>;
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
  if (!Number.isFinite(costUsd) || !Number.isFinite(usdToBrlRate)) return null;
  return Math.round((costUsd * usdToBrlRate + Number.EPSILON) * 100) / 100;
}

export default function DashboardPage({ onNavigate, usdToBrlRate, quoteStatus = 'ready', results = [], resultsStatus = 'idle', resultsError = '', batches = [], batchesStatus = 'idle', batchesError = '', keyConfigured = false, now = new Date() }) {
  const [period, setPeriod] = useState('Hoje');
  const [loading, setLoading] = useState(true);
  const metrics = useMemo(() => getDashboardMetrics({ results, batches, period, now }), [results, batches, period, now]);
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
  const health = [
    { label: 'Storage', detail: 'Disponível em evolução', icon: Database, status: 'Monitoramento futuro', tone: 'slate' },
    { label: 'Renderer', detail: 'Disponível em evolução', icon: WandSparkles, status: 'Monitoramento futuro', tone: 'slate' },
    { label: 'Branding', detail: 'Disponível em evolução', icon: Sparkles, status: 'Monitoramento futuro', tone: 'slate' },
    { label: 'DeepSeek', detail: 'Disponível em evolução', icon: Activity, status: 'Monitoramento futuro', tone: 'slate' },
    { label: 'OpenRouter', detail: keyConfigured ? 'Chave local configurada' : 'Chave local não configurada', icon: GalleryVerticalEnd, status: keyConfigured ? 'Configurado' : 'Não configurado', tone: keyConfigured ? 'sky' : 'amber' },
  ];
  const insights = getInsights(metrics);

  if (loading) return <DashboardSkeleton/>;

  return <div className="space-y-8 pb-6">
    <section aria-labelledby="dashboard-executive" className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:px-8 sm:py-8">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-slate-100/90 blur-3xl"/>
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"><Sparkles size={13} className="text-slate-700"/> Operations Center</div><h1 id="dashboard-executive" className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">Bom dia, Rafael.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Acompanhe a produção, os custos e os próximos movimentos da operação em um só lugar.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Período do dashboard">{PERIODS.map((item) => <button key={item} type="button" onClick={() => choosePeriod(item)} aria-pressed={period === item} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === item ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}>{item}</button>)}</div><button type="button" onClick={() => onNavigate?.('generation')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"><Plus size={16}/> Nova Produção</button></div></div>
        <div className="relative mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Resumo da produção</p><p className="mt-1 text-sm font-semibold text-slate-900">{metrics.generatedCount} imagens geradas</p></div><div><p className="text-xs text-slate-400">Resultados prontos</p><p className="mt-1 text-sm font-semibold text-slate-900">{metrics.readyResults} aprovadas · {metrics.pendingResults} em revisão</p></div><div><p className="text-xs text-slate-400">Base de leitura</p><p className="mt-1 text-sm font-semibold text-slate-900">Dados locais dos últimos {period === 'Hoje' ? 'hoje' : period}</p></div></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Imagens geradas" value={String(metrics.generatedCount)} detail="Neste período" icon={FileImage}/><MetricCard label="Tempo médio" value={formatDuration(metrics.averageDurationMs)} detail={metrics.averageDurationMs === null ? 'Sem dados suficientes' : 'Por geração concluída'} icon={Clock3}/><MetricCard label="IA principal" value={metrics.mainModel ? presentModelLabel(metrics.mainModel) : 'Não informado'} valueTitle={metrics.mainModel || undefined} detail={metrics.mainModel ? 'Mais usada no período' : 'Sem modelo registrado no período'} icon={Sparkles}/><MetricCard label="Lotes ativos" value={String(metrics.activeBatches.length)} detail={`${metrics.completedBatches.length} concluído(s) · ${metrics.queueItems} na fila`} icon={Layers3}/></div>
      <div className="grid gap-4 lg:grid-cols-3"><MetricCard label="Custo em dólar" value={costUsd === null ? 'Não informado' : formatUsd(costUsd)} detail={costUsd === null ? 'Sem custos registrados no período' : `${metrics.costSampleCount} custo(s) registrado(s)`} accent="text-emerald-700" icon={ArrowUpRight}/><MetricCard label="Custo total em reais" value={brlValue} detail={brlDetail} accent="text-emerald-700" icon={ArrowUpRight}/><MetricCard label="Taxa de sucesso" value="Não informado" detail="Monitoramento futuro: falhas individuais persistidas" accent="text-slate-600" icon={CheckCircle2}/></div>
    </section>

    <section aria-labelledby="dashboard-production" className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Produção</p><h2 id="dashboard-production" className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-950">Ritmo e fluxo da operação</h2></div><div className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)_minmax(300px,0.85fr)]"><SectionCard title="Produção por dia" description="Histórico disponível após mais produções."><div className="mt-2"><ProductionChart values={[18, 27, 23, 36, 31, 47, 42]}/><div className="mt-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Hoje</span></div></div></SectionCard><SectionCard title="Produções recentes" description="Resultados locais mais recentes.">{resultsStatus === 'error' ? <p role="alert" className="mt-6 text-sm text-rose-700">{resultsError || 'Não foi possível carregar os resultados locais.'}</p> : operationalLoading && metrics.recent.length === 0 ? <div className="flex min-h-40 items-center justify-center text-sm text-slate-400"><Loader2 className="animate-spin" size={18}/></div> : metrics.recent.length ? <ol className="mt-1 divide-y divide-slate-100">{metrics.recent.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-center gap-3 py-3 first:pt-1" title={item.absoluteTime}><span className={`h-2 w-2 shrink-0 rounded-full ${item.tone === 'emerald' ? 'bg-emerald-500' : item.tone === 'amber' ? 'bg-amber-400' : item.tone === 'rose' ? 'bg-rose-500' : 'bg-slate-300'}`}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{item.name}</p><p className="mt-0.5 text-xs text-slate-400">{item.time}</p></div><span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">{item.label}</span></li>)}</ol> : <p className="mt-6 text-sm text-slate-500">Nenhuma produção local registrada ainda.</p>}<button type="button" onClick={() => onNavigate?.('results')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950">Ver resultados <ChevronRight size={14}/></button></SectionCard><SectionCard title="Fila em andamento" description="Lotes locais ativos e seus itens pendentes.">{batchesStatus === 'error' ? <p role="alert" className="mt-6 text-sm text-rose-700">{batchesError || 'Não foi possível carregar os lotes locais.'}</p> : metrics.activeBatches.length ? <div className="space-y-3">{metrics.activeBatches.map((batch) => { const finished = (batch.completedItems || 0) + (batch.failedItems || 0) + (batch.cancelledItems || 0) + (batch.interruptedItems || 0); const progress = batch.totalItems ? Math.round((finished / batch.totalItems) * 100) : 0; return <article key={batch.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{batch.name}</p><p className="mt-1 text-xs text-slate-500">{finished} concluído(s) · {Math.max(0, batch.totalItems - finished)} aguardando</p></div><span className="shrink-0 text-xs font-semibold text-slate-700">{batch.totalItems} imagens</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${progress}%` }}/></div></article>; })}</div> : <p className="mt-6 text-sm text-slate-500">Nenhum lote local ativo no momento.</p>}<button type="button" onClick={() => onNavigate?.('batches')} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-950">Abrir Produção em Lotes <ArrowRight size={14}/></button></SectionCard></div></section>

    <section aria-labelledby="dashboard-reliability" className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Confiabilidade</p><h2 id="dashboard-reliability" className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-950">Saúde da operação</h2></div><p className="text-xs text-slate-400">Status local disponível e monitoramento futuro claramente separados.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{health.map(({ label, detail, icon: Icon, status, tone }) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start justify-between"><span className="rounded-xl bg-white p-2 text-slate-600 shadow-sm"><Icon size={16}/></span><span className={`h-2 w-2 rounded-full ${tone === 'sky' ? 'bg-sky-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-slate-300'}`}/></div><p className="mt-4 text-sm font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p><p className="mt-3 text-[11px] font-semibold text-slate-600">{status}</p></div>)}</div></section>

    <section aria-labelledby="dashboard-intelligence" className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Inteligência operacional</p><h2 id="dashboard-intelligence" className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-950">Leituras e próximos passos</h2></div><div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><SectionCard title="Insights" description="Leituras determinísticas, sem chamada de IA."><div className="space-y-3">{insights.map((text) => <Insight key={text} text={text}/>)}</div></SectionCard><SectionCard title="Ações rápidas" description="Comece o próximo passo da sua operação."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{quickActions.map(({ label, description, icon: Icon, view }) => <button key={label} type="button" onClick={() => onNavigate?.(view)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"><span className="rounded-xl bg-slate-950 p-2.5 text-white"><Icon size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span><ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700"/></button>)}</div></SectionCard></div></section>

    <section aria-label="Distribuições demonstrativas" className="border-t border-slate-100 pt-6"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center"><span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">Dados demonstrativos</span><span className="text-xs text-slate-400">Histórico consolidado de Stories e modelos em evolução.</span></div><div className="grid gap-4 lg:grid-cols-3">{distributions.map((item) => <Donut key={item.label} item={item}/>)}</div></section>
  </div>;
}

function Insight({ text }) {
  return <div className="flex gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-4"><span className="rounded-xl bg-white p-2 text-violet-600 shadow-sm"><Sparkles size={15}/></span><p className="pt-1 text-sm leading-5 text-slate-700">{text}</p></div>;
}

export { DashboardSkeleton };
export { formatUsd, formatBrl, convertUsdToBrl };
