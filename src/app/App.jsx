import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
import AppShell from './AppShell.jsx';
import TemplatePicker from '../features/generation/components/TemplatePicker.jsx';
import GarmentUploader from '../features/generation/components/GarmentUploader.jsx';
import ModelSummary from '../features/generation/components/ModelSummary.jsx';
import CreditConfirmation from '../features/generation/components/CreditConfirmation.jsx';
import GenerationProgress from '../features/generation/components/GenerationProgress.jsx';
import ComparisonGrid from '../features/generation/components/ComparisonGrid.jsx';
import ResultActions from '../features/generation/components/ResultActions.jsx';
import OpenRouterSettingsModal from '../features/settings/components/OpenRouterSettingsModal.jsx';
import { fetchConfig } from '../features/generation/api/generationClient.js';
import useGeneration from '../features/generation/hooks/useGeneration.js';
import { useObjectUrl } from '../features/generation/utils/imagePreview.js';
import { inspectGarmentFile, withBlockingError } from '../features/generation/utils/inspectUpload.js';
import { imagePolicy } from '../../shared/imagePolicy.js';
import { ADDITIONAL_INSTRUCTION_MAX_LENGTH } from '../../shared/additionalInstructionPolicy.js';
import TemplatesPage from '../features/templates/components/TemplatesPage.jsx';
import useTemplates from '../features/templates/hooks/useTemplates.js';
import ResultsPage from '../features/results/components/ResultsPage.jsx';
import useResults from '../features/results/hooks/useResults.js';
import BatchesPage from '../features/batches/components/BatchesPage.jsx';
import useBatches from '../features/batches/hooks/useBatches.js';
import BrandingPage from '../features/branding/components/BrandingPage.jsx';

const initialConfig = {
  keyConfigured: false,
  model: null,
  fixedGeneration: { resolution: '1K', aspectRatio: '1:1' },
  clothingScope: 'Roupas superiores',
  imagePolicy,
};

export default function App() {
  const [config, setConfig] = useState(initialConfig);
  const [bootstrapState, setBootstrapState] = useState('loading');
  const [bootstrapError, setBootstrapError] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateImageErrors, setTemplateImageErrors] = useState({});
  const [garmentFile, setGarmentFile] = useState(null);
  const [garmentAssessment, setGarmentAssessment] = useState(null);
  const [garmentInspecting, setGarmentInspecting] = useState(false);
  const [garmentError, setGarmentError] = useState('');
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [additionalInstruction, setAdditionalInstruction] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState('generation');
  const templateCatalog = useTemplates();
  const resultHistory = useResults(activeView === 'results');
  const batchesState = useBatches(activeView === 'batches');
  const templates = templateCatalog.templates;
  const garmentPreviewUrl = useObjectUrl(garmentFile);
  const inspectionSequenceRef = useRef(0);
  const { status, result, error, referenceSnapshot, generate, reset } = useGeneration();

  useEffect(() => {
    let ignore = false;
    fetchConfig()
      .then((nextConfig) => {
        if (ignore) return;
        setConfig(nextConfig);
        setBootstrapState('ready');
      })
      .catch((nextError) => {
        if (ignore) return;
        setBootstrapError(nextError.message || 'Não foi possível carregar a configuração local.');
        setBootstrapState('error');
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (templateCatalog.status !== 'ready') return;
    setSelectedTemplateId((current) => {
      const selected = templates.find((template) => template.id === current);
      if (selected?.valid && selected.active !== false) return current;
      return templates.find((template) => template.valid && template.active !== false)?.id || '';
    });
    setTemplateImageErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => templates.some((template) => template.id === id))));
  }, [templateCatalog.status, templates]);

  useEffect(() => () => {
    inspectionSequenceRef.current += 1;
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );
  const selectedTemplateValid = Boolean(selectedTemplate && selectedTemplate.valid !== false && selectedTemplate.active !== false && !templateImageErrors[selectedTemplateId]);
  const profileIncomplete = Boolean(selectedTemplate && !selectedTemplate.prompt?.trim());
  const isBusy = status === 'preparing' || status === 'generating';
  const canGenerate = Boolean(
    config.keyConfigured
    && selectedTemplateId
    && selectedTemplateValid
    && !profileIncomplete
    && garmentFile
    && garmentAssessment?.valid
    && !garmentInspecting
    && confirmPaid
    && !isBusy
    && !templateCatalog.mutationPending
    && bootstrapState === 'ready'
    && templateCatalog.status === 'ready'
  );

  async function handleGarmentChange(file) {
    const sequence = inspectionSequenceRef.current + 1;
    inspectionSequenceRef.current = sequence;
    setGarmentError('');
    setGarmentAssessment(null);
    setConfirmPaid(false);
    reset();
    setGarmentFile(file);
    if (!file) {
      setGarmentInspecting(false);
      return;
    }

    setGarmentInspecting(true);
    try {
      const assessment = await inspectGarmentFile(file, config.imagePolicy || imagePolicy);
      if (inspectionSequenceRef.current !== sequence) return;
      setGarmentAssessment(assessment);
      setGarmentError(assessment.errors[0]?.message || '');
    } catch {
      if (inspectionSequenceRef.current !== sequence) return;
      const message = 'Não foi possível ler o arquivo selecionado. Exporte a imagem novamente.';
      setGarmentError(message);
      setGarmentAssessment({ valid: false, quality: 'unsuitable', qualityLabel: 'Inadequada', errors: [{ code: 'CLIENT_READ_FAILED', message }], warnings: [] });
    } finally {
      if (inspectionSequenceRef.current === sequence) setGarmentInspecting(false);
    }
  }

  function handleGarmentDecodeError() {
    setGarmentAssessment((current) => current
      ? withBlockingError(current, 'IMAGE_DECODE_FAILED', 'O navegador não conseguiu carregar a imagem completa. Exporte o arquivo novamente.')
      : current);
    setGarmentError('O navegador não conseguiu carregar a imagem completa. Exporte o arquivo novamente.');
    setConfirmPaid(false);
  }

  function handleGarmentInputError(message) {
    inspectionSequenceRef.current += 1;
    setGarmentInspecting(false);
    setGarmentError(message);
    setGarmentFile(null);
    setGarmentAssessment({ valid: false, quality: 'unsuitable', qualityLabel: 'Inadequada', errors: [{ code: 'CLIENT_FILE_ERROR', message }], warnings: [] });
    setConfirmPaid(false);
    reset();
  }

  function handleGenerate() {
    if (!canGenerate) return;
    generate({
      templateId: selectedTemplateId,
      modelId: config.model?.id,
      garmentFile,
      garmentAssessment,
      confirmPaid,
      template: selectedTemplate,
      additionalInstruction: additionalInstruction.trim() || undefined,
    });
  }

  const handleKeyStatusChange = useCallback((nextStatus) => {
    setConfig((current) => ({ ...current, keyConfigured: nextStatus.configured }));
  }, []);

  return (
    <AppShell keyConfigured={config.keyConfigured} activeView={activeView} onNavigate={setActiveView} onOpenSettings={() => setSettingsOpen(true)}>
      {activeView === 'templates' ? (
        <TemplatesPage catalog={templateCatalog} policy={config.imagePolicy || imagePolicy} generationBusy={isBusy} />
      ) : activeView === 'results' ? (
        <ResultsPage history={resultHistory} />
      ) : activeView === 'batches' ? (
        <BatchesPage batchesState={batchesState} templates={templates} keyConfigured={config.keyConfigured} onOpenResult={(resultId) => { setActiveView('results'); resultHistory.open(resultId).catch(() => {}); }} />
      ) : activeView === 'branding' ? (
        <BrandingPage open={activeView === 'branding'} variant="page" />
      ) : (
        <>
      <header className="mb-8 flex flex-col gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Sparkles size={14} className="text-slate-700" />
            PRIME IA STUDIO
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950">Nova geração</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Valide a troca de uma roupa superior em uma fotografia de catálogo, com processamento local e uma única chamada paga.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
          <span className={`h-2 w-2 rounded-full ${config.keyConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {config.keyConfigured ? 'Chave configurada' : 'Chave não configurada'}
        </div>
      </header>

      {(bootstrapState === 'loading' || templateCatalog.status === 'loading') && (
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="animate-spin text-slate-500" size={24} />
        </div>
      )}

      {(bootstrapState === 'error' || templateCatalog.status === 'error') && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">A configuração local não carregou.</p>
            <p className="mt-1 text-rose-700">{bootstrapError || templateCatalog.error}</p>
          </div>
        </div>
      )}

      {bootstrapState === 'ready' && templateCatalog.status === 'ready' && (
        <div className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
            <div className="space-y-6">
              <TemplatePicker
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                disabled={isBusy}
                aspectRatio={config.fixedGeneration.aspectRatio}
                templateImageErrors={templateImageErrors}
                onImageError={(templateId) => setTemplateImageErrors((current) => ({
                  ...current,
                  [templateId]: 'Não foi possível carregar a imagem local deste template.',
                }))}
                onSelect={(id) => {
                  setSelectedTemplateId(id);
                  reset();
                }}
              />
              <GarmentUploader
                file={garmentFile}
                previewUrl={garmentPreviewUrl}
                assessment={garmentAssessment}
                inspecting={garmentInspecting}
                policy={config.imagePolicy || imagePolicy}
                error={garmentError}
                disabled={isBusy}
                onFileChange={handleGarmentChange}
                onPreviewError={handleGarmentDecodeError}
                onError={handleGarmentInputError}
              />
            </div>

            <div className="space-y-6">
              <ModelSummary config={config} />

              {selectedTemplate && profileIncomplete && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <p>Este Template ainda não tem um perfil de geração configurado. Configure o prompt antes de gerar.</p>
                </div>
              )}

              <label className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
                <span className="text-sm font-semibold text-slate-900">Instrução adicional desta geração <span className="font-normal text-slate-400">(opcional)</span></span>
                <textarea
                  value={additionalInstruction}
                  onChange={(event) => setAdditionalInstruction(event.target.value)}
                  maxLength={ADDITIONAL_INSTRUCTION_MAX_LENGTH}
                  rows={3}
                  disabled={isBusy}
                  placeholder="Ex.: aplicar acabamento fosco nesta geração."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-100"
                />
                <span className="mt-1 block text-right text-[11px] text-slate-400">{additionalInstruction.length}/{ADDITIONAL_INSTRUCTION_MAX_LENGTH}</span>
              </label>

              <CreditConfirmation checked={confirmPaid} disabled={isBusy} onChange={setConfirmPaid} />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Pronto para testar?</p>
                    <p className="mt-1 text-sm leading-5 text-slate-500">Uma geração por clique. O resultado será salvo automaticamente no computador.</p>
                  </div>
                  <ArrowUpRight size={18} className="text-slate-400" />
                </div>
                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={handleGenerate}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isBusy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                  {isBusy ? 'Gerando e salvando…' : 'Gerar imagem'}
                </button>
                <p className="mt-3 text-center text-xs text-slate-400">Roupas superiores · {config.fixedGeneration.resolution} · {config.fixedGeneration.aspectRatio}</p>
              </div>
            </div>
          </section>

          {(isBusy || status === 'success' || status === 'error') && <GenerationProgress status={status} error={error} />}

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Não foi possível concluir a geração.</p>
                <p className="mt-1 text-rose-700">{error.message}</p>
              </div>
            </div>
          )}

          {result && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resultado</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">Comparação da geração</h2>
                </div>
                <ResultActions result={result} />
              </div>
              {!result.localSave?.saved && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  A imagem foi gerada, mas o salvamento automático falhou. Faça o download agora.
                </div>
              )}
              <ComparisonGrid
                template={referenceSnapshot?.template}
                garmentPreviewUrl={referenceSnapshot?.garment.previewUrl}
                result={result}
                aspectRatio={config.fixedGeneration.aspectRatio}
              />
            </section>
          )}
        </div>
      )}
        </>
      )}
      <OpenRouterSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onStatusChange={handleKeyStatusChange}
        onNavigateToBranding={() => { setSettingsOpen(false); setActiveView('branding'); }}
      />
    </AppShell>
  );
}
