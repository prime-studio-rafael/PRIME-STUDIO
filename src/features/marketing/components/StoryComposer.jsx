import { AlertCircle, Check, Eye, Flag, ImageOff, Loader2, Maximize2, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { INSTAGRAM_SAFE_AREA, STORY_CANVAS, STORY_HANDLE, STORY_LOGO_SIZES, getStoryLayout, getStoryLogoBox, resolveStoryLogoVariant } from '../../../../shared/storyLayoutSpec.js';
import { layoutStoryText, storyTextWarnings } from '../../../../shared/storyTextLayout.js';
import { generateStorySuggestions, marketingAssetUrl } from '../api/marketingClient.js';
import { fetchBrandingState, BRANDING_APPROVED_LOGO_URL, BRANDING_WHITE_LOGO_URL } from '../../branding/api/brandingClient.js';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-100';

export default function StoryComposer({ week, sources, layouts, story, busy, onSave, onGenerate, onCancel }) {
  const initial = story ? normalize(story) : { sourceResultId: sources[0]?.id || '', sourceAssetVariant: 'original', productLabel: '', priority: false, priceText: '', calloutText: '', headline: '', subheadline: '', ctaText: 'Saiba mais', logoMode: 'auto', logoSize: 'medium', storyTemplateId: layouts[0]?.id || 'product-highlight', scheduledDate: week.weekStart, scheduledTime: '10:00', order: week.stories.length + 1 };
  const [form, setForm] = useState(initial);
  const [showFullSize, setShowFullSize] = useState(false);
  const [imageState, setImageState] = useState('loading');
  const [logoState, setLogoState] = useState('loading');
  const [branding, setBranding] = useState({ primary: true, white: false, loaded: false });
  const [assistant, setAssistant] = useState({ marketingGoal: 'novidade', tone: 'premium', additionalInstruction: '', suggestions: [], loading: false, error: '', unavailable: false });
  const suggestionAbort = useRef(null);
  const selectedSource = sources.find((source) => source.id === form.sourceResultId);
  const selectedLayout = getStoryLayout(form.storyTemplateId) || getStoryLayout('product-highlight');
  const logoChoice = resolveStoryLogoVariant(selectedLayout, form.logoMode, branding.white);
  const logoUnavailable = !logoChoice.variant || (logoChoice.variant === 'primary' && !branding.primary);
  const sourceUrl = story ? marketingAssetUrl(week.id, story.id, 'source') : form.sourceAssetVariant === 'branded' ? selectedSource?.brandedPreviewUrl : selectedSource?.originalPreviewUrl;
  const dirty = story && JSON.stringify(normalize(story)) !== JSON.stringify(form);
  const finalUrl = story?.renderStatus === 'ready' && !dirty ? marketingAssetUrl(week.id, story.id, 'story') : null;
  const warnings = useMemo(() => storyTextWarnings(form), [form]);
  const required = Boolean(form.sourceResultId && form.productLabel.trim() && form.scheduledDate && form.scheduledTime && form.order > 0);
  const canRender = required && !warnings.length && !logoUnavailable && (finalUrl || (Boolean(sourceUrl) && imageState === 'ready' && logoState === 'ready'));
  const set = (field) => (event) => {
    const value = field === 'order' ? Number(event.target.value) : event.target.value;
    setForm((current) => field === 'sourceResultId'
      ? { ...current, sourceResultId: value, sourceAssetVariant: sources.find((source) => source.id === value)?.brandedAvailable && current.sourceAssetVariant === 'branded' ? 'branded' : 'original' }
      : { ...current, [field]: value });
    if (field === 'sourceResultId' || field === 'sourceAssetVariant') setImageState('loading');
    if (field === 'logoMode' || field === 'logoSize') setLogoState('loading');
  };
  const selectLayout = (id) => { setForm((current) => ({ ...current, storyTemplateId: id })); setLogoState('loading'); };
  const submit = async (event) => { event.preventDefault(); if (!required) return; await onSave(form); };
  const generate = async () => { if (!canRender) return; await onGenerate(form); };
  const generateSuggestions = async () => {
    if (!form.productLabel.trim() || assistant.loading) return;
    const controller = new AbortController();
    suggestionAbort.current = controller;
    setAssistant((current) => ({ ...current, loading: true, error: '', unavailable: false, suggestions: [] }));
    try {
      const result = await generateStorySuggestions({ productLabel: form.productLabel, sourceCategory: selectedSource?.categoryLabel || '', priceText: form.priceText, marketingGoal: assistant.marketingGoal, tone: assistant.tone, additionalInstruction: assistant.additionalInstruction }, controller.signal);
      setAssistant((current) => ({ ...current, loading: false, suggestions: result.suggestions || [] }));
    } catch (error) {
      if (error?.name === 'AbortError' || error?.code === 'DEEPSEEK_SUGGESTIONS_CANCELLED') return;
      setAssistant((current) => ({ ...current, loading: false, error: error.message || 'Não foi possível gerar sugestões.', unavailable: error.code === 'DEEPSEEK_NOT_CONFIGURED' }));
    } finally { suggestionAbort.current = null; }
  };
  const cancelSuggestions = () => {
    suggestionAbort.current?.abort();
    suggestionAbort.current = null;
    setAssistant((current) => ({ ...current, loading: false }));
  };
  useEffect(() => () => suggestionAbort.current?.abort(), []);
  useEffect(() => { let active = true; fetchBrandingState().then((state) => { if (active) setBranding({ primary: Boolean(state.variants?.primary?.approved || state.approved), white: Boolean(state.variants?.white?.approved), loaded: true }); }).catch(() => { if (active) setBranding((current) => ({ ...current, loaded: true })); }); return () => { active = false; }; }, []);
  const applySuggestion = (suggestion) => setForm((current) => ({ ...current, ...suggestion }));

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-950">{story ? 'Editar Story' : 'Criar Story'}</h2><p className="mt-1 text-xs text-slate-500">A prévia é atualizada localmente enquanto você edita.</p></div>{story && <button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cancelar edição"><X size={17}/></button>}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(300px,0.72fr)] xl:items-start">
      <form onSubmit={submit} className="order-1 space-y-4">
        <Field label="Resultado aprovado"><select value={form.sourceResultId} onChange={set('sourceResultId')} disabled={busy} className={inputClass}><option value="">Selecione</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.templateLabel || source.id}</option>)}</select></Field>
        <Field label="Variante"><select value={form.sourceAssetVariant} onChange={set('sourceAssetVariant')} disabled={busy || !selectedSource} className={inputClass}><option value="original">Original</option>{selectedSource?.brandedAvailable && <option value="branded">Com Branding</option>}</select></Field>
        <Field label="Nome ou código do produto"><TextControl aria-label="Nome ou código do produto" value={form.productLabel} max={32} onChange={set('productLabel')} disabled={busy}/></Field>
        <label className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800"><input type="checkbox" checked={Boolean(form.priority)} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.checked }))} disabled={busy}/><Flag size={14}/> Produto prioritário</label>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Preço (opcional)"><TextControl aria-label="Preço (opcional)" value={form.priceText} max={20} onChange={set('priceText')} disabled={busy} placeholder="R$ 99,90"/></Field><Field label="Agenda"><input type="date" min={week.weekStart} max={addDays(week.weekStart, 6)} value={form.scheduledDate} onChange={set('scheduledDate')} disabled={busy} className={inputClass}/></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Horário"><input type="time" value={form.scheduledTime} onChange={set('scheduledTime')} disabled={busy} className={inputClass}/></Field><Field label="Ordem"><input type="number" min="1" max="999" value={form.order} onChange={set('order')} disabled={busy} className={inputClass}/></Field></div>
        <Field label="Chamada curta (opcional)"><TextControl aria-label="Chamada curta (opcional)" value={form.calloutText} max={48} onChange={set('calloutText')} disabled={busy} placeholder="Condição especial" words={6}/></Field>
        <Field label="Headline (opcional)"><TextControl aria-label="Headline (opcional)" value={form.headline} max={48} onChange={set('headline')} disabled={busy} placeholder="Seu produto em destaque" words={4}/></Field>
        <Field label="Subheadline (opcional)"><TextControl aria-label="Subheadline (opcional)" value={form.subheadline} max={80} onChange={set('subheadline')} disabled={busy} placeholder="Detalhes ou benefício da oferta" words={8}/></Field>
        <Field label="CTA (opcional)"><TextControl aria-label="CTA (opcional)" value={form.ctaText} max={28} onChange={set('ctaText')} disabled={busy} placeholder="Compre agora" words={3}/></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Logo"><select aria-label="Logo" value={form.logoMode} onChange={set('logoMode')} disabled={busy} className={inputClass}><option value="auto">Automática</option><option value="primary">Principal</option><option value="white">Branca</option></select></Field><Field label="Tamanho da logo"><select aria-label="Tamanho da logo" value={form.logoSize} onChange={set('logoSize')} disabled={busy} className={inputClass}>{Object.values(STORY_LOGO_SIZES).map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}</select></Field></div>
        <p className={`rounded-lg px-3 py-2 text-xs font-medium ${logoUnavailable ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-600'}`}>{logoUnavailable ? 'Logo branca não configurada. Escolha Automática ou Principal.' : form.logoMode === 'auto' ? `Automática — ${logoChoice.fallback ? 'logo branca indisponível; usando logo principal' : `usando logo ${logoChoice.variant === 'white' ? 'branca' : 'principal'}`}` : `Usando logo ${logoChoice.variant === 'white' ? 'branca' : 'principal'}`}</p>
        <StoryAiAssistant value={assistant} disabled={busy || !form.productLabel.trim()} onChange={(changes) => setAssistant((current) => ({ ...current, ...changes }))} onGenerate={generateSuggestions} onCancel={cancelSuggestions} onApply={applySuggestion}/>
        {!sources.length && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Aprove um resultado na tela Resultados para começar.</p>}
        {warnings.length > 0 && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">Revise os textos antes de gerar.</p><ul className="mt-1 list-disc pl-4">{warnings.map((warning) => <li key={warning.field}>{fieldName(warning.field)}: {warning.warning}</li>)}</ul></div>}
        {imageState === 'error' && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">A imagem selecionada não está disponível. Escolha outro Resultado ou variante.</div>}
        {logoState === 'error' && !logoUnavailable && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">A logo selecionada não está disponível. Verifique o Branding antes de gerar.</div>}
        <div className="flex flex-col gap-2 sm:flex-row"><button type="submit" disabled={busy || !required} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} {story ? 'Salvar alterações' : 'Salvar rascunho'}</button><button type="button" disabled={busy || !canRender} onClick={() => generate().catch(() => {})} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} Gerar Story final</button></div>
        {dirty && <p className="text-xs font-medium text-amber-700">O arquivo final está desatualizado até você salvar e gerar novamente.</p>}
      </form>
      <aside className="order-2 min-w-0 xl:sticky xl:top-5"><StoryPreview form={form} sourceUrl={sourceUrl} finalUrl={finalUrl} imageState={imageState} logoState={logoState} logoChoice={logoChoice} onImageLoad={() => setImageState('ready')} onImageError={() => setImageState('error')} onLogoLoad={() => setLogoState('ready')} onLogoError={() => setLogoState('error')} showSafeArea/><div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{dirty ? 'Alterações locais não renderizadas' : finalUrl ? 'Arquivo final conferido' : 'Atualizado agora'}</p><button type="button" onClick={() => setShowFullSize(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><Maximize2 size={14}/> Ver tamanho real</button></div><LayoutPicker layouts={layouts} selected={form.storyTemplateId} onSelect={selectLayout}/><div className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500"><p className="font-semibold text-slate-700">Dicas rápidas</p><p>O contorno pontilhado representa a área segura do Instagram. A imagem usa contenção proporcional e não sofre crop.</p></div></aside>
    </div>
    {showFullSize && <PreviewModal form={form} sourceUrl={sourceUrl} imageState={imageState} logoChoice={logoChoice} onClose={() => setShowFullSize(false)}/>}
  </section>;
}

function StoryAiAssistant({ value, disabled, onChange, onGenerate, onCancel, onApply }) {
  return <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-950"><div className="flex items-center gap-2"><Sparkles size={15}/><h3 className="font-semibold">Assistente IA</h3></div><p className="mt-1 text-indigo-800">Gera três opções textuais para o Story. Nenhuma sugestão é aplicada automaticamente.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Objetivo de marketing"><select aria-label="Objetivo de marketing" value={value.marketingGoal} onChange={(event) => onChange({ marketingGoal: event.target.value })} disabled={disabled || value.loading} className={inputClass}>{[['novidade', 'Novidade'], ['oferta', 'Oferta'], ['desejo', 'Desejo'], ['qualidade', 'Qualidade'], ['look', 'Look'], ['presente', 'Presente'], ['ultimas-unidades', 'Últimas unidades'], ['whatsapp', 'Chamada para WhatsApp']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="Tom de voz"><select aria-label="Tom de voz" value={value.tone} onChange={(event) => onChange({ tone: event.target.value })} disabled={disabled || value.loading} className={inputClass}>{[['premium', 'Premium'], ['direto', 'Direto'], ['elegante', 'Elegante'], ['urgente', 'Urgente'], ['descontraído', 'Descontraído']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field></div><Field label="Instrução adicional (opcional)"><textarea aria-label="Instrução adicional para IA" value={value.additionalInstruction} maxLength={300} onChange={(event) => onChange({ additionalInstruction: event.target.value })} disabled={disabled || value.loading} className={`${inputClass} min-h-20 resize-y`} placeholder="Ex.: destaque o estilo versátil"/></Field><div className="mt-3 flex gap-2"><button type="button" onClick={() => onGenerate().catch(() => {})} disabled={disabled || value.loading} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-45">{value.loading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} Gerar 3 sugestões</button>{value.loading && <button type="button" onClick={onCancel} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-900">Cancelar</button>}</div>{value.unavailable && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">Configure a chave do DeepSeek em Configurações para usar o Assistente IA.</p>}{value.error && !value.unavailable && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">{value.error}</p>}{value.suggestions.length > 0 && <div className="mt-4 space-y-3">{value.suggestions.map((suggestion, index) => <article key={`${suggestion.headline}-${index}`} className="rounded-xl border border-indigo-100 bg-white p-3"><p className="font-semibold text-slate-900">Sugestão {index + 1}</p><dl className="mt-2 space-y-1 text-slate-600"><div><dt className="inline font-medium">Chamada: </dt><dd className="inline">{suggestion.calloutText}</dd></div><div><dt className="inline font-medium">Headline: </dt><dd className="inline">{suggestion.headline}</dd></div><div><dt className="inline font-medium">Subheadline: </dt><dd className="inline">{suggestion.subheadline}</dd></div><div><dt className="inline font-medium">CTA: </dt><dd className="inline">{suggestion.ctaText}</dd></div></dl><button type="button" onClick={() => onApply(suggestion)} className="mt-3 rounded-lg border border-indigo-200 px-3 py-1.5 text-[11px] font-semibold text-indigo-800">Aplicar esta sugestão</button></article>)}</div>}</section>;
}

export function StoryPreview({ form, sourceUrl, imageState, logoState, logoChoice = { variant: 'primary' }, onImageLoad, onImageError, onLogoLoad, onLogoError, showSafeArea = false, finalUrl = null }) {
  const layout = getStoryLayout(form.storyTemplateId) || getStoryLayout('product-highlight');
  const styleBox = (box) => ({ left: pct(box.left, 'x'), top: pct(box.top, 'y'), width: pct(box.width, 'x'), height: pct(box.height, 'y') });
  const textStyle = (position, weight, color) => ({
    left: pct(position.x, 'x'),
    top: pct(position.y - position.fontSize, 'y'),
    width: pct(position.maxWidth, 'x'),
    maxWidth: pct(position.maxWidth, 'x'),
    boxSizing: 'border-box',
    fontSize: `clamp(9px, ${(position.fontSize / STORY_CANVAS.width) * 100}vw, ${(position.fontSize / STORY_CANVAS.width) * 390}px)`,
    lineHeight: position.lineHeight / position.fontSize,
    fontWeight: weight,
    color,
    textAlign: position.align,
    ...(position.align === 'center' ? { transform: 'translateX(-50%)' } : {}),
  });
  const renderText = (field, position, weight, color) => { const result = layoutStoryText(form[field], field); return result.lines.length ? <p style={textStyle(position, weight, color)} className="absolute m-0 whitespace-pre-line" data-field={field}>{result.lines.join('\n')}</p> : null; };
  return <div><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-950">Preview do Story</h3><p className="mt-0.5 text-[11px] text-slate-500">1080 × 1920 · visualização local</p></div><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Eye size={13}/> Atualizado agora</span></div><div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[22px] border-[7px] border-slate-950 bg-slate-950 shadow-xl"><div className="relative w-full overflow-hidden" style={{ aspectRatio: '9 / 16', background: layout.background }}>
    {sourceUrl && !finalUrl && <img src={sourceUrl} alt="Imagem selecionada para o Story" onLoad={onImageLoad} onError={onImageError} className="absolute object-contain" style={styleBox(layout.image)}/>} {finalUrl && <img src={finalUrl} alt="Story final renderizado" className="absolute inset-0 h-full w-full object-contain"/>}
    {!sourceUrl && !finalUrl && <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-slate-500"><ImageOff size={28}/><p className="mt-3 text-xs font-semibold">Selecione um Resultado aprovado</p></div>}
    {imageState === 'error' && !finalUrl && <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 text-center text-rose-700"><AlertCircle size={26}/><p className="mt-2 px-6 text-xs font-semibold">Imagem indisponível</p></div>}
    {!finalUrl && logoChoice.variant && <img
      src={logoChoice.variant === 'white' ? BRANDING_WHITE_LOGO_URL : BRANDING_APPROVED_LOGO_URL}
      alt="Logo aprovada"
      className={`absolute object-contain ${logoState === 'error' ? 'hidden' : ''}`}
      style={styleBox(getStoryLogoBox(layout, form.logoSize || 'medium'))}
      onLoad={onLogoLoad}
      onError={onLogoError}
    />}
    {!finalUrl && <>{renderText('productLabel', layout.text.productLabel, 700, layout.colors.primary)}{renderText('calloutText', layout.text.calloutText, 500, layout.colors.muted)}{renderText('headline', layout.text.headline, 700, layout.colors.primary)}{renderText('subheadline', layout.text.subheadline, 400, layout.colors.muted)}{renderText('priceText', layout.text.priceText, 800, layout.colors.price)}{layout.cta && form.ctaText && <><span className="absolute" style={{ ...styleBox(layout.cta), background: layout.colors.accent, borderRadius: `${pct(layout.cta.radius, 'x')}vw` }}/>{renderText('ctaText', layout.text.ctaText, 700, layout.colors.accentText)}</>}<span className="absolute font-medium" style={textStyle(layout.handle, 500, layout.colors.muted)}>{STORY_HANDLE}</span></>}
    {showSafeArea && <span
      aria-label="Área segura do Instagram"
      className="pointer-events-none absolute border border-dashed border-sky-400/70"
      style={{ left: pct(INSTAGRAM_SAFE_AREA.left, 'x'), right: pct(INSTAGRAM_SAFE_AREA.right, 'x'), top: pct(INSTAGRAM_SAFE_AREA.top, 'y'), bottom: pct(INSTAGRAM_SAFE_AREA.bottom, 'y') }}
    />}
  </div></div>{finalUrl && <p className="mt-2 text-center text-xs font-semibold text-emerald-700">Arquivo final renderizado</p>}</div>;
}

function LayoutPicker({ layouts, selected, onSelect }) { return <div className="mt-5"><p className="mb-2 text-xs font-semibold text-slate-700">Layout visual</p><div className="grid grid-cols-3 gap-2">{layouts.map((layout) => <button type="button" key={layout.id} aria-pressed={selected === layout.id} onClick={() => onSelect(layout.id)} className={`rounded-xl border p-2 text-left transition ${selected === layout.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="mb-2 block aspect-[9/16] overflow-hidden rounded-md" style={{ background: layout.background }}><span className="block h-[48%] w-[78%] translate-x-[14%] translate-y-[15%] rounded bg-slate-300/80"/><span className="mt-2 ml-[14%] block h-1.5 w-[55%] rounded bg-current opacity-60"/><span className="mt-1 ml-[14%] block h-1.5 w-[42%] rounded bg-current opacity-35"/></span><span className="block text-[10px] font-semibold leading-4">{layout.label}</span></button>)}</div></div>; }
function PreviewModal({ form, sourceUrl, imageState, logoChoice, onClose }) { return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Story em tamanho real"><div className="relative flex max-h-full max-w-full flex-col items-center"><button type="button" onClick={onClose} className="mb-3 self-end rounded-full bg-white p-2 text-slate-700" aria-label="Fechar tamanho real"><X size={18}/></button><div className="max-h-[calc(100vh-90px)] w-auto max-w-full"><StoryPreview form={form} sourceUrl={sourceUrl} imageState={imageState} logoChoice={logoChoice}/></div></div></div>; }
function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>{children}</label>; }
function TextControl({ value, max, words, onChange, ...props }) { const count = String(value || '').trim().split(/\s+/).filter(Boolean).length; return <><input value={value} maxLength={max} onChange={onChange} className={inputClass} {...props}/><span className="mt-1 block text-right text-[10px] text-slate-400">{String(value || '').length}/{max}{words ? ` · ${count}/${words} palavras` : ''}</span></>; }
function normalize(story) { return { ...story, priceText: story.priceText || '', calloutText: story.calloutText || '', headline: story.headline || '', subheadline: story.subheadline || '', ctaText: story.ctaText || '', logoMode: story.logoMode || 'auto', logoSize: story.logoSize || 'medium' }; }
function fieldName(field) { return ({ calloutText: 'Chamada curta', headline: 'Headline', subheadline: 'Subheadline', ctaText: 'CTA', priceText: 'Preço', productLabel: 'Produto' })[field] || field; }
function addDays(value, amount) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function pct(value, axis) { return `${(value / (axis === 'x' ? STORY_CANVAS.width : STORY_CANVAS.height)) * 100}%`; }
