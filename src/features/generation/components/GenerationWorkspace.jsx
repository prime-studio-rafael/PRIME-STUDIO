import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useGeneration } from '../hooks/useGeneration.js';
import ComparisonGrid from './ComparisonGrid.jsx';
import GarmentUploader from './GarmentUploader.jsx';
import GenerationControls from './GenerationControls.jsx';
import TemplatePicker from './TemplatePicker.jsx';

export default function GenerationWorkspace({ config, templates, requestGeneration }) {
  const generation = useGeneration({ config, requestGeneration });
  const [garmentPreviewUrl, setGarmentPreviewUrl] = useState('');

  useEffect(() => {
    if (!generation.garmentFile) {
      setGarmentPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(generation.garmentFile);
    setGarmentPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [generation.garmentFile]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === generation.templateId) ?? null,
    [generation.templateId, templates],
  );

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-7 lg:px-10 lg:py-10">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Protótipo local
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Nova geração</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Valide a fidelidade de uma roupa superior com um modelo-base local. Uma geração por vez, sem retry automático.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm">
          <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden="true" />
          Chave protegida no backend
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)] sm:p-7">
          <TemplatePicker
            templates={templates}
            selectedId={generation.templateId}
            disabled={generation.isBusy}
            onSelect={generation.selectTemplate}
          />
          <GarmentUploader
            file={generation.garmentFile}
            disabled={generation.isBusy}
            error={generation.error && generation.status === 'error' && !generation.garmentFile ? generation.error : ''}
            onChange={generation.setGarmentFile}
          />
        </div>

        <GenerationControls config={config} generation={generation} />
      </div>

      <ComparisonGrid
        template={selectedTemplate}
        garmentPreviewUrl={garmentPreviewUrl}
        result={generation.result}
      />
    </div>
  );
}
