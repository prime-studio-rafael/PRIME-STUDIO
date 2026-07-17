import { ImageOff, Loader2 } from 'lucide-react';
import SectionCard from '../../../components/ui/SectionCard.jsx';
import TemplateLibraryToolbar from '../../templates/components/TemplateLibraryToolbar.jsx';
import TemplateLibraryLoadMore from '../../templates/components/TemplateLibraryLoadMore.jsx';
import TemplateTagList from '../../templates/components/TemplateTagList.jsx';
import useTemplateCategories from '../../templates/hooks/useTemplateCategories.js';
import useTemplateLibraryPage from '../../templates/hooks/useTemplateLibraryPage.js';

export default function TemplatePicker({ templates, selectedTemplateId, disabled = false, aspectRatio = '1:1', onSelect, templateImageErrors = {}, onImageError }) {
  const templateCategories = useTemplateCategories();
  const library = useTemplateLibraryPage({ pageSize: 8 });

  return (
    <SectionCard
      eyebrow="Etapa 01"
      title="Escolha o modelo-base"
      description="As fotografias locais podem ser substituídas por novos modelos-base aprovados da PRIME STORE."
    >
      {templates.length > 1 && (
        <TemplateLibraryToolbar
          categories={templateCategories.categories}
          search={library.search}
          onSearchChange={library.setSearch}
          category={library.category}
          onCategoryChange={library.setCategory}
        />
      )}
      {library.initialLoading && library.items.length === 0 && (
        <div className="flex min-h-[160px] items-center justify-center"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {library.items.map((template) => {
          const selected = template.id === selectedTemplateId;
          const metadataInvalid = template.valid === false;
          const inactive = template.active === false;
          const imageInvalid = Boolean(templateImageErrors[template.id]);
          const invalid = metadataInvalid || imageInvalid || inactive;
          const validationMessage = template.validationError || templateImageErrors[template.id] || 'Não foi possível carregar a imagem local deste template.';
          return (
            <button
              key={template.id}
              type="button"
              aria-pressed={selected}
              disabled={invalid || disabled}
              title={template.hoverDescription || template.description || undefined}
              onClick={() => !invalid && !disabled && onSelect(template.id)}
              className={`group overflow-hidden rounded-xl border text-left transition disabled:cursor-not-allowed disabled:opacity-80 ${selected ? 'border-slate-950 ring-2 ring-slate-950/10' : 'border-slate-200 hover:border-slate-400'}`}
            >
              <div className="overflow-hidden bg-slate-100" style={{ aspectRatio: aspectRatio.replace(':', ' / ') }}>
                {invalid ? (
                  <div role="img" aria-label={`${template.label} indisponível`} className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-slate-500">
                    <ImageOff size={22} />
                    <span className="text-xs font-semibold">{inactive ? 'Template inativo' : 'Template indisponível'}</span>
                    <span className="text-[10px] leading-4">{inactive ? 'Ative este template na tela Templates para usá-lo.' : validationMessage}</span>
                  </div>
                ) : (
                  <img
                    src={template.publicUrl}
                    alt={template.label}
                    loading="lazy"
                    onError={() => onImageError?.(template.id)}
                    className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.01]"
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-800">{template.label}</span>
                  {invalid ? (
                    <span className={`mt-1 block text-[10px] font-medium ${inactive ? 'text-slate-500' : 'text-rose-600'}`}>{inactive ? 'Inativo para geração.' : 'Corrija o arquivo local para continuar.'}</span>
                  ) : (
                    <>
                      <span className="mt-1 block text-[10px] text-slate-500">{formatTemplateMeta(template)}</span>
                      {!template.fourByFiveReady && <span className="mt-1 block text-[10px] font-medium text-amber-700">Fora da tolerância 4:5</span>}
                      <TemplateTagList tags={template.tags} max={2} className="mt-1.5" />
                    </>
                  )}
                </div>
                <span className={`h-2 w-2 rounded-full ${selected ? 'bg-slate-950' : 'bg-slate-200'}`} />
              </div>
            </button>
          );
        })}
      </div>
      <TemplateLibraryLoadMore hasMore={library.hasMore} loading={library.loadingMore} error={library.loadMoreError} onLoadMore={library.loadMore} />
    </SectionCard>
  );
}

function formatTemplateMeta(template) {
  const mime = template.realFormat ? template.realFormat.toUpperCase() : template.mimeType ? template.mimeType.replace('image/', '').toUpperCase() : 'Formato não identificado';
  const dimensions = template.width && template.height ? ` · ${template.width}×${template.height}` : '';
  const size = Number.isFinite(template.sizeBytes) && template.sizeBytes > 0 ? ` · ${formatBytes(template.sizeBytes)}` : '';
  return `${mime}${dimensions}${size}`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
