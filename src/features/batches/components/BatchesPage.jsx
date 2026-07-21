import { useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, FolderPlus, Info, Layers3, Loader2, Pause, Play, PlusCircle, Square, Upload } from 'lucide-react';
import SectionCard from '../../../components/ui/SectionCard.jsx';
import BatchSummaryCards from './BatchSummaryCards.jsx';
import BatchItemRow from './BatchItemRow.jsx';
import useTemplateCategories from '../../templates/hooks/useTemplateCategories.js';
import { DEFAULT_TEMPLATE_CATEGORY_ID } from '../../templates/hooks/useTemplateLibraryFilters.js';
import { ADDITIONAL_INSTRUCTION_MAX_LENGTH } from '../../../../shared/additionalInstructionPolicy.js';

const money = (value) => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) : 'Não informado';
const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const BATCH_STATUS = {
  draft: ['Rascunho', 'bg-slate-100 text-slate-600'],
  ready: ['Pronto', 'bg-slate-100 text-slate-700'],
  running: ['Em execução', 'bg-blue-50 text-blue-700'],
  paused: ['Pausado', 'bg-amber-50 text-amber-700'],
  completed: ['Concluído', 'bg-emerald-50 text-emerald-700'],
  completed_with_errors: ['Concluído com erros', 'bg-amber-50 text-amber-800'],
  cancelled: ['Cancelado', 'bg-rose-50 text-rose-700'],
  interrupted: ['Interrompido', 'bg-amber-50 text-amber-700'],
};
function StatusBadge({ status }) {
  const [label, className] = BATCH_STATUS[status] || ['Não informado', 'bg-slate-100 text-slate-600'];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${className}`}>{label}</span>;
}

function ProgressHeaderTooltip() {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button type="button" aria-label="Como o progresso é calculado" className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-600">
        <Info size={12} />
      </button>
      {visible && (
        <div role="tooltip" className="absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] normal-case leading-4 text-slate-600 shadow-[0_12px_36px_rgba(15,23,42,0.12)]">
          Progresso calculado com base na etapa atual do processamento.
        </div>
      )}
    </span>
  );
}

export default function BatchesPage({ batchesState, templates, keyConfigured, onOpenResult }) {
  const { batches, selected, select, status, error, submit, action } = batchesState;
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState(''); const [templateId, setTemplateId] = useState(''); const [files, setFiles] = useState([]); const [confirmed, setConfirmed] = useState(false); const [additionalInstruction, setAdditionalInstruction] = useState(''); const [submitting, setSubmitting] = useState(false); const [formError, setFormError] = useState(''); const input = useRef();
  const activeTemplates = templates.filter((template) => template.valid && template.active !== false);
  const templateCategories = useTemplateCategories();
  const templateGroups = useMemo(() => groupTemplatesByCategory(activeTemplates, templateCategories.categories), [activeTemplates, templateCategories.categories]);
  const estimated = files.length * 0.034;
  const selectedTemplate = useMemo(() => activeTemplates.find((template) => template.id === templateId), [activeTemplates, templateId]);
  const profileIncomplete = Boolean(selectedTemplate && !selectedTemplate.prompt?.trim());
  const runningCount = useMemo(() => batches.filter((batch) => batch.status === 'running').length, [batches]);

  async function create(event) {
    event.preventDefault(); setFormError('');
    if (!name.trim() || !templateId || !files.length || !confirmed) { setFormError('Preencha o nome, selecione um template, adicione roupas e confirme os créditos.'); return; }
    if (profileIncomplete) { setFormError('Este Template ainda não tem um perfil de geração configurado. Configure o prompt antes de criar um lote.'); return; }
    setSubmitting(true);
    try { await submit({ name, templateId, files, additionalInstruction: additionalInstruction.trim() || undefined }); setName(''); setFiles([]); setConfirmed(false); setAdditionalInstruction(''); setFormOpen(false); }
    catch (e) { setFormError(e.message); }
    finally { setSubmitting(false); }
  }
  function accept(next) { setFiles((current) => [...current, ...Array.from(next)].slice(0, 200)); }

  return (
    <div className="space-y-7">
      <header className="border-b border-slate-200 pb-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"><Layers3 size={14} /> PRIME IA STUDIO</div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Produção em Lotes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Uma roupa por vez, com custo e progresso persistidos localmente.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{batches.length} lote{batches.length === 1 ? '' : 's'}</span>
            {runningCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse motion-reduce:animate-none" />{runningCount} em execução</span>}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
        <button type="button" onClick={() => setFormOpen((open) => !open)} aria-expanded={formOpen} className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition-colors duration-200 hover:bg-slate-50/60 sm:px-6">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FolderPlus size={17} /> Novo lote</span>
          {formOpen ? <ChevronUp size={17} className="text-slate-400" /> : <ChevronDown size={17} className="text-slate-400" />}
        </button>
        {formOpen && (
          <form onSubmit={create} className="space-y-4 border-t border-slate-100 p-5 sm:p-6">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                maxLength="100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Template</span>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              >
                <option value="">Selecione um template</option>
                {templateGroups.map((group) => <optgroup key={group.id} label={group.label}>{group.templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</optgroup>)}
              </select>
              {selectedTemplate && <span className="mt-1.5 block text-xs text-slate-500">{selectedTemplate.width}×{selectedTemplate.height} · {selectedTemplate.mimeType}</span>}
              {profileIncomplete && (
                <span className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" /> Este Template ainda não tem um perfil de geração configurado.
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Instrução adicional desta geração <span className="font-normal text-slate-400">(opcional)</span></span>
              <textarea
                value={additionalInstruction}
                onChange={(e) => setAdditionalInstruction(e.target.value)}
                maxLength={ADDITIONAL_INSTRUCTION_MAX_LENGTH}
                rows={2}
                placeholder="Ex.: aplicar acabamento fosco neste lote."
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              />
              <span className="mt-1 block text-right text-[11px] text-slate-400">{additionalInstruction.length}/{ADDITIONAL_INSTRUCTION_MAX_LENGTH}</span>
            </label>
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); accept(e.dataTransfer.files); }} className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
              <Upload className="mx-auto text-slate-400" size={20} />
              <p className="mt-2 text-sm text-slate-600">Arraste roupas ou selecione arquivos</p>
              <button type="button" onClick={() => input.current?.click()} className="mt-1.5 text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:decoration-slate-500">Selecionar imagens</button>
              <input ref={input} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => accept(e.target.files)} />
            </div>
            {files.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-auto rounded-lg border border-slate-100 p-2 text-xs text-slate-600">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-slate-50">
                    <span className="truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button type="button" className="shrink-0 font-semibold text-rose-600 transition hover:text-rose-700" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>Remover</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-700">{files.length} itens · estimativa por item US$ 0.034</p>
              <p className="mt-1 font-semibold text-slate-900">Total estimado: {money(estimated)}</p>
              <p className="mt-1 text-xs text-slate-500">O custo real pode variar e só é registrado quando informado pelo provedor.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-slate-950 focus:ring-2 focus:ring-slate-950/20" />
              Confirmo que o lote poderá consumir créditos.
            </label>
            {(formError || error) && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{formError || error}</p>}
            <button disabled={submitting || !keyConfigured || profileIncomplete} className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{submitting ? 'Criando…' : !keyConfigured ? 'Configure a chave para continuar' : profileIncomplete ? 'Configure o perfil do Template' : 'Criar lote para revisão'}</button>
          </form>
        )}
      </section>

      <SectionCard eyebrow="Lotes locais" title={status === 'loading' ? 'Atualizando…' : `${batches.length} lote(s)`}>
        {status === 'loading' && batches.length === 0 && <div className="flex min-h-[160px] items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={22} /></div>}
        {status === 'error' && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={17} /><span>{error}</span></div>}
        {status !== 'loading' && batches.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 py-10 text-center">
            <Layers3 size={26} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-900">Nenhum lote criado ainda</p>
            <p className="max-w-xs text-xs text-slate-500">Crie um lote para gerar várias roupas em sequência sobre o mesmo template.</p>
            <button type="button" onClick={() => setFormOpen(true)} className="mt-1 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white"><PlusCircle size={15} /> Criar primeiro lote</button>
          </div>
        )}
        {batches.length > 0 && (
          <div className="space-y-2">
            {batches.map((batch) => {
              const finished = batch.totalItems ? batch.completedItems + batch.failedItems + batch.cancelledItems + batch.interruptedItems : 0;
              const progress = batch.totalItems ? Math.round((finished / batch.totalItems) * 100) : 0;
              const isSelected = selected?.id === batch.id;
              return (
                <button
                  type="button"
                  key={batch.id}
                  onClick={() => select(batch)}
                  aria-pressed={isSelected}
                  className={`relative w-full rounded-xl border bg-white py-3.5 pl-4 pr-4 text-left transition-all duration-200 ${isSelected ? 'border-slate-300 bg-slate-50/60 shadow-[0_4px_16px_rgba(15,23,42,0.05)]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/40 hover:shadow-[0_2px_10px_rgba(15,23,42,0.03)]'}`}
                >
                  <span className={`absolute inset-y-2 left-0 w-[3px] rounded-full bg-slate-900 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{batch.name}</strong>
                      <p className="mt-0.5 text-xs text-slate-500">{batch.templateLabel} · {batch.totalItems} itens · {Number.isFinite(batch.actualCostUsd) ? money(batch.actualCostUsd) : `${money(batch.estimatedCostUsd)} (estimado)`}</p>
                    </div>
                    <StatusBadge status={batch.status} />
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-slate-900 transition-[width] duration-700 ease-out ${batch.status === 'running' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {!selected && batches.length > 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <Layers3 size={26} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-900">Selecione um lote para ver os detalhes</p>
        </div>
      )}
      {selected && <BatchDetail batch={selected} action={action} onOpenResult={onOpenResult} />}
    </div>
  );
}

function BatchDetail({ batch, action, onOpenResult }) {
  const [pendingAction, setPendingAction] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const finished = batch.items.filter((item) => terminal.has(item.status)).length;
  const canStart = ['ready', 'paused', 'interrupted'].includes(batch.status) && batch.items.some((item) => item.status === 'queued');
  const progress = batch.totalItems ? Math.round((finished / batch.totalItems) * 100) : 0;

  async function run(actionName, payload) {
    setPendingAction(actionName);
    try { await action(actionName, payload); } finally { setPendingAction(''); setConfirmingCancel(false); }
  }

  return (
    <SectionCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{batch.name}</h2><StatusBadge status={batch.status} /></div>
          <p className="mt-1 text-sm text-slate-500">{batch.templateLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button type="button" disabled={pendingAction !== ''} onClick={() => run(batch.status === 'paused' ? 'resume' : 'start', { confirmPaid: true })} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {pendingAction === 'start' || pendingAction === 'resume' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {batch.status === 'paused' ? 'Retomar' : 'Iniciar'}
            </button>
          )}
          {batch.status === 'running' && (
            <button type="button" disabled={pendingAction !== ''} onClick={() => run('pause')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50">
              {pendingAction === 'pause' ? <Loader2 size={15} className="animate-spin" /> : <Pause size={15} />} Pausar
            </button>
          )}
          {['ready', 'running', 'paused', 'interrupted'].includes(batch.status) && !confirmingCancel && (
            <button type="button" disabled={pendingAction !== ''} onClick={() => setConfirmingCancel(true)} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-50">
              <Square size={15} /> Cancelar
            </button>
          )}
          {confirmingCancel && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <span>Cancelar este lote?</span>
              <button type="button" disabled={pendingAction !== ''} onClick={() => run('cancel')} className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white disabled:opacity-50">{pendingAction === 'cancel' ? <Loader2 size={13} className="animate-spin" /> : 'Sim'}</button>
              <button type="button" disabled={pendingAction !== ''} onClick={() => setConfirmingCancel(false)} className="rounded-md border border-rose-200 px-2 py-1 font-semibold">Não</button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6"><BatchSummaryCards items={batch.items} /></div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>{finished}/{batch.totalItems} finalizados</span>
          <span>Estimado {money(batch.estimatedCostUsd)} · Real {money(batch.actualCostUsd)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-slate-900 transition-[width] duration-700 ease-out ${batch.status === 'running' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Em tablet, a tabela mantém as 7 colunas completas (nenhuma é escondida/removida) — o
          scroll horizontal fica restrito a este wrapper, nunca à página inteira. */}
      <div className="mt-5 overflow-x-auto overscroll-x-contain rounded-lg">
        <div className="hidden sm:grid sm:min-w-[840px] sm:grid-cols-[minmax(0,2.2fr)_104px_168px_72px_92px_56px_104px] items-center gap-4 rounded-t-lg border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Produto</span>
          <span>Status</span>
          <span className="flex items-center gap-1">Progresso <ProgressHeaderTooltip /></span>
          <span>Tempo</span>
          <span>Custo</span>
          <span>Resultado</span>
          <span className="text-right">Ações</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {batch.items.map((item) => <BatchItemRow key={item.id} batchId={batch.id} item={item} onOpenResult={onOpenResult} />)}
        </ul>
      </div>
    </SectionCard>
  );
}

function groupTemplatesByCategory(templates, categories) {
  const byCategory = new Map();
  for (const template of templates) {
    const categoryId = template.category || DEFAULT_TEMPLATE_CATEGORY_ID;
    if (!byCategory.has(categoryId)) byCategory.set(categoryId, []);
    byCategory.get(categoryId).push(template);
  }
  const orderedIds = [...categories.map((category) => category.id), DEFAULT_TEMPLATE_CATEGORY_ID].filter((id) => byCategory.has(id));
  const knownIds = new Set(orderedIds);
  const remainingIds = [...byCategory.keys()].filter((id) => !knownIds.has(id));
  return [...orderedIds, ...remainingIds].map((id) => ({
    id,
    label: categories.find((category) => category.id === id)?.label || 'Outros',
    templates: byCategory.get(id),
  }));
}
