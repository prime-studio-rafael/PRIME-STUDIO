import { useMemo, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock3, Pause, ShieldCheck } from 'lucide-react';

const FILTERS = Object.freeze([
  ['all', 'Todos'], ['batch', 'Lote'], ['item', 'Item selecionado'], ['failures', 'Falhas'],
]);

const EVENT_COPY = Object.freeze({
  batch_created: 'Lote criado.',
  batch_started: 'Produção do lote iniciada.',
  batch_resumed: 'Produção retomada somente com itens pendentes.',
  pause_requested: 'Pausa solicitada; a geração atual não é interrompida.',
  batch_paused: 'Lote pausado.',
  batch_interrupted: 'Lote interrompido porque o servidor foi reiniciado.',
  cancel_requested: 'Cancelamento solicitado; uma geração já iniciada pode continuar.',
  batch_cancelled: 'Lote cancelado.',
  batch_completed: 'Processamento do lote concluído.',
  item_preparing: 'Item preparado para geração.',
  item_requeued: 'Item retornou à fila porque a pausa foi solicitada antes da geração.',
  item_generation_started: 'Geração do item iniciada.',
  item_completed: 'Item concluído.',
  item_failed: 'Item falhou durante a geração.',
  item_cancelled: 'Item cancelado antes de uma nova geração.',
  item_interrupted: 'Item interrompido porque o servidor foi reiniciado.',
  item_result_recovered: 'Resultado local recuperado sem nova geração.',
  recovery_ignored_invalid_metadata: 'A recuperação foi ignorada porque os dados persistidos não eram válidos.',
  recovery_ignored_invalid_asset: 'A recuperação foi ignorada porque o arquivo local não era válido.',
  recovery_ignored_conflict: 'A recuperação foi ignorada porque havia mais de um resultado possível.',
  recovery_ignored_incorrect_association: 'A recuperação foi ignorada porque a associação persistida não era válida.',
});

const FAILURE_EVENTS = new Set(['item_failed', 'recovery_ignored_invalid_metadata', 'recovery_ignored_invalid_asset', 'recovery_ignored_conflict', 'recovery_ignored_incorrect_association']);
const SUCCESS_EVENTS = new Set(['item_completed', 'item_result_recovered', 'batch_completed']);
const USD_FORMATTER = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const ISO_UTC_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export default function BatchTimeline({ batch }) {
  const [filter, setFilter] = useState('all');
  const [itemId, setItemId] = useState(() => batch.items?.[0]?.id || '');
  const events = useMemo(() => normalizeEvents(batch.events), [batch.events]);
  const visibleEvents = useMemo(() => events.filter((event) => {
    if (filter === 'batch') return event.itemId === null;
    if (filter === 'item') return event.itemId === itemId;
    if (filter === 'failures') return FAILURE_EVENTS.has(event.type);
    return true;
  }), [events, filter, itemId]);
  const metrics = useMemo(() => getMetrics(batch.items, events), [batch.items, events]);
  const lastActivity = events.at(-1);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="batch-timeline-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Activity size={16} className="text-slate-500" /><h3 id="batch-timeline-title" className="text-sm font-semibold text-slate-950">Diagnóstico do lote</h3></div>
          <p className="mt-1 text-xs leading-5 text-slate-500">Eventos persistidos localmente. Nenhum reenvio automático ao provedor foi realizado.</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="font-medium text-slate-700">Última atividade</p>
          <p>{lastActivity ? formatDate(lastActivity.at) : 'Ainda não há eventos'}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Custo acumulado" value={formatUsd(metrics.totalCost)} />
        <Metric label="Custo médio" value={metrics.averageCost === null ? 'Não informado' : formatUsd(metrics.averageCost)} />
        <Metric label="Tempo total gerado" value={metrics.totalDuration === null ? 'Não informado' : formatDuration(metrics.totalDuration)} />
        <Metric label="Duração média" value={metrics.averageDuration === null ? 'Não informado' : formatDuration(metrics.averageDuration)} />
        <Metric label="Interrupções / recuperações" value={`${metrics.interrupted} / ${metrics.recovered}`} />
      </dl>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar histórico do lote">
          {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>)}
        </div>
        {filter === 'item' && (
          <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-600">
            Item
            <select value={itemId} onChange={(event) => setItemId(event.target.value)} className="min-w-0 max-w-52 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800">
              {(batch.items || []).map((item) => <option key={item.id} value={item.id}>{item.originalFileName || 'Item sem identificação'}</option>)}
            </select>
          </label>
        )}
      </div>

      {visibleEvents.length === 0 ? (
        <div className="mt-4 flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
          <Clock3 size={18} className="text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">Nenhum evento neste filtro</p>
          <p className="mt-1 text-xs text-slate-500">O histórico será formado pelas transições reais deste lote.</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-3" aria-label="Linha do tempo do lote">
          {visibleEvents.map((event) => <TimelineEvent key={event.id} event={event} item={batch.items?.find((current) => current.id === event.itemId)} />)}
        </ol>
      )}
    </section>
  );
}

function TimelineEvent({ event, item }) {
  const failed = FAILURE_EVENTS.has(event.type);
  const successful = SUCCESS_EVENTS.has(event.type);
  const Icon = failed ? AlertCircle : successful ? CheckCircle2 : event.type.includes('pause') ? Pause : ShieldCheck;
  return (
    <li className="relative flex gap-3 pl-1">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${failed ? 'bg-rose-50 text-rose-700' : successful ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}><Icon size={13} /></span>
      <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-xs font-semibold text-slate-800">{EVENT_COPY[event.type] || 'Evento do lote registrado.'}</p>
          <time dateTime={event.at} className="shrink-0 text-[11px] text-slate-500">{formatDate(event.at)}</time>
        </div>
        {item && <p className="mt-1 truncate text-[11px] text-slate-500">Item: {item.originalFileName || 'Sem identificação'}</p>}
        {(event.fromStatus || event.toStatus) && <p className="mt-1 text-[11px] text-slate-500">{event.fromStatus || '—'} → {event.toStatus || '—'}</p>}
        <EventData data={event.data} />
      </div>
    </li>
  );
}

function EventData({ data = {} }) {
  const values = [];
  if (Number.isFinite(data.costUsd)) values.push(`Custo ${formatUsd(data.costUsd)}`);
  if (Number.isFinite(data.durationMs)) values.push(`Duração ${formatDuration(data.durationMs)}`);
  if (data.providerRequestId) values.push(`Request ID ${data.providerRequestId}`);
  if (data.resultId) values.push(`Resultado ${data.resultId}`);
  if (data.count > 1) values.push(`${data.count} ocorrências`);
  return values.length ? <p className="mt-1.5 break-words text-[11px] text-slate-500">{values.join(' · ')}</p> : null;
}

function Metric({ label, value }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"><dt className="text-[11px] font-medium text-slate-500">{label}</dt><dd className="mt-0.5 text-sm font-semibold text-slate-800">{value}</dd></div>; }

function normalizeEvents(events) {
  return Array.isArray(events)
    ? [...events]
      .filter((event) => event?.id && event?.type && isCanonicalTimestamp(event.at))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    : [];
}

function getMetrics(items = [], events = []) {
  const completed = items.filter((item) => item.status === 'completed');
  const costs = completed.map((item) => item.costUsd).filter(Number.isFinite);
  const durations = completed.map((item) => item.durationMs).filter((value) => Number.isFinite(value) && value >= 0);
  return {
    totalCost: costs.length ? costs.reduce((sum, value) => sum + value, 0) : null,
    averageCost: costs.length ? costs.reduce((sum, value) => sum + value, 0) / costs.length : null,
    totalDuration: durations.length ? durations.reduce((sum, value) => sum + value, 0) : null,
    averageDuration: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    interrupted: events.filter((event) => event.type === 'item_interrupted').length,
    recovered: events.filter((event) => event.type === 'item_result_recovered').length,
  };
}

function formatUsd(value) { return Number.isFinite(value) ? USD_FORMATTER.format(value) : 'Não informado'; }
function formatDuration(value) { return Number.isFinite(value) ? value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s` : 'Não informado'; }
function formatDate(value) {
  const timestamp = isCanonicalTimestamp(value) ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? DATE_FORMATTER.format(new Date(timestamp)) : 'Horário indisponível';
}

function isCanonicalTimestamp(value) {
  if (typeof value !== 'string' || !ISO_UTC_MILLISECONDS.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
