import { AlertCircle, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import TemplateCard from './TemplateCard.jsx';
import TemplateFormModal from './TemplateFormModal.jsx';
import TemplateLibraryToolbar from './TemplateLibraryToolbar.jsx';
import TemplateLibraryLoadMore from './TemplateLibraryLoadMore.jsx';
import useTemplateCategories from '../hooks/useTemplateCategories.js';
import useTemplateLibraryPage from '../hooks/useTemplateLibraryPage.js';

export default function TemplatesPage({ catalog, policy, generationBusy }) {
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const actionsDisabled = generationBusy || catalog.mutationPending;
  const templateCategories = useTemplateCategories();
  const library = useTemplateLibraryPage();

  async function run(operation, successMessage) {
    setFeedback(null);
    try {
      await operation();
      setModal(null);
      setDeleteTarget(null);
      setFeedback({ type: 'success', message: successMessage });
      await library.reload();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível concluir a operação.' });
      throw error;
    }
  }

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"><ImagePlus size={14} /> PRIME IA STUDIO</div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950">Templates</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Gerencie as fotografias locais usadas como modelo-base, sem editar arquivos manualmente.</p>
        </div>
        <button type="button" disabled={actionsDisabled} onClick={() => setModal({ mode: 'create', template: null })} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
          <Plus size={17} /> Novo template
        </button>
      </header>

      {generationBusy && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Uma geração está ativa. A visualização permanece disponível, mas as alterações estão bloqueadas.</div>}
      {feedback && <div role={feedback.type === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl border px-4 py-3 text-sm ${feedback.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{feedback.message}</div>}

      {catalog.status === 'loading' && <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 size={24} className="animate-spin text-slate-500" /></div>}
      {catalog.status === 'error' && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">Os templates locais não carregaram.</p><p className="mt-1">{catalog.error}</p><button type="button" onClick={() => catalog.load().catch(() => {})} className="mt-3 font-semibold underline">Tentar novamente</button></div>
        </div>
      )}

      {catalog.status === 'ready' && catalog.templates.length === 0 && (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
          <ImagePlus size={30} className="text-slate-400" />
          <h2 className="mt-4 text-base font-semibold text-slate-900">Nenhum template local</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Adicione uma fotografia vertical para começar. A geração permanecerá bloqueada enquanto não houver um template válido e ativo.</p>
        </div>
      )}

      {catalog.status === 'ready' && catalog.templates.length > 0 && (
        <TemplateLibraryToolbar
          categories={templateCategories.categories}
          search={library.search}
          onSearchChange={library.setSearch}
          category={library.category}
          onCategoryChange={library.setCategory}
        />
      )}

      {catalog.status === 'ready' && catalog.templates.length > 0 && !library.initialLoading && library.items.length === 0 && (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
          <ImagePlus size={26} className="text-slate-400" />
          <h2 className="mt-4 text-base font-semibold text-slate-900">Nenhum template neste filtro</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Ajuste a busca ou escolha outra categoria.</p>
        </div>
      )}

      {catalog.status === 'ready' && catalog.templates.length > 0 && library.initialLoading && library.items.length === 0 && (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 size={22} className="animate-spin text-slate-500" /></div>
      )}

      {catalog.status === 'ready' && library.items.length > 0 && (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {library.items.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                categories={templateCategories.categories}
                disabled={actionsDisabled}
                onEdit={() => setModal({ mode: 'edit', template })}
                onReplace={() => setModal({ mode: 'replace', template })}
                onDuplicate={() => run(() => catalog.duplicate(template.id), 'Template duplicado com sucesso.').catch(() => {})}
                onToggle={() => run(() => catalog.setActive(template.id, !template.active), template.active ? 'Template desativado.' : 'Template ativado.').catch(() => {})}
                onDelete={() => setDeleteTarget(template)}
              />
            ))}
          </div>
          <TemplateLibraryLoadMore hasMore={library.hasMore} loading={library.loadingMore} error={library.loadMoreError} onLoadMore={library.loadMore} />
        </>
      )}

      <TemplateFormModal
        open={Boolean(modal)}
        mode={modal?.mode || 'create'}
        template={modal?.template || null}
        policy={policy}
        categories={templateCategories.categories}
        busy={catalog.mutationPending}
        onClose={() => !catalog.mutationPending && setModal(null)}
        onSubmit={(data) => {
          if (modal.mode === 'create') return run(() => catalog.create(data), 'Template criado com sucesso.');
          if (modal.mode === 'edit') return run(() => catalog.update(modal.template.id, data), 'Template atualizado com sucesso.');
          return run(() => catalog.replaceImage(modal.template.id, data.file), 'Imagem substituída com sucesso.');
        }}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-template-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={19} /></div>
            <h2 id="delete-template-title" className="mt-4 text-lg font-semibold text-slate-950">Excluir {deleteTarget.label}?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">A imagem e o registro local serão removidos. Esta ação não altera resultados já gerados.</p>
            {feedback?.type === 'error' && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{feedback.message}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={catalog.mutationPending} onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
              <button type="button" disabled={catalog.mutationPending} onClick={() => run(() => catalog.remove(deleteTarget.id), 'Template excluído.').catch(() => {})} className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{catalog.mutationPending && <Loader2 size={15} className="animate-spin" />}Excluir</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
