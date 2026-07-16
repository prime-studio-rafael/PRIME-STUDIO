import { Check, Circle, CircleAlert, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';

const STEPS = [
  { id: 'validating', label: 'Validar entradas' },
  { id: 'preparing', label: 'Preparar referências' },
  { id: 'generating', label: 'Gerar e salvar localmente' },
];

const STEP_INDEX = new Map(STEPS.map((step, index) => [step.id, index]));

export default function GenerationControls({ config, generation }) {
  const currentStep = STEP_INDEX.get(generation.status) ?? -1;
  const isSuccess = generation.status === 'success';

  return (
    <aside className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] xl:sticky xl:top-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Configuração fixa</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Pronto para validar</h2>
        </div>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
          MVP local
        </span>
      </div>

      <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/70 px-4">
        <div className="flex items-start justify-between gap-5 py-4">
          <dt className="text-xs text-slate-500">Modelo</dt>
          <dd className="max-w-[210px] text-right text-xs font-medium text-slate-900">
            {config.model.name}
            <span className="mt-1 block break-all font-mono text-[9px] font-normal text-slate-400">
              {config.model.technicalId}
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-5 py-4">
          <dt className="text-xs text-slate-500">Saída</dt>
          <dd className="text-xs font-medium text-slate-900">
            {config.image.resolution} · {config.image.aspectRatio}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-5 py-4">
          <dt className="text-xs text-slate-500">Escopo</dt>
          <dd className="text-xs font-medium text-slate-900">Roupas superiores</dd>
        </div>
      </dl>

      {config.image.aspectRatioStatus !== 'confirmed' ? (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {config.image.aspectRatioBlockingReason || 'Formato temporário 1:1. A ativação de 4:5 ainda está bloqueada.'}
        </div>
      ) : null}

      {!config.keyConfigured ? (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Adicione a chave ao arquivo <code className="font-mono text-[11px] text-slate-900">.env</code> somente quando autorizar o teste pago.
        </div>
      ) : null}

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
        <input
          type="checkbox"
          checked={generation.confirmedPaid}
          disabled={generation.isBusy}
          onChange={(event) => generation.setConfirmedPaid(event.target.checked)}
          className="mt-0.5 size-4 rounded border-slate-300 accent-slate-950"
        />
        <span className="text-xs leading-5 text-slate-600">
          Confirmo que esta geração utilizará créditos reais do OpenRouter.
        </span>
      </label>

      <button
        type="button"
        disabled={!generation.canGenerate}
        onClick={generation.generate}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {generation.isBusy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        {generation.isBusy ? 'Gerando imagem…' : 'Gerar imagem'}
      </button>

      {(generation.isBusy || isSuccess) && (
        <div className="mt-6 border-t border-slate-100 pt-5" aria-live="polite">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Progresso</p>
          <ol className="space-y-3">
            {STEPS.map((step, index) => {
              const completed = isSuccess || currentStep > index;
              const active = !isSuccess && currentStep === index;
              return (
                <li key={step.id} className="flex items-center gap-3 text-xs text-slate-600">
                  {completed ? (
                    <span className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                  ) : active ? (
                    <LoaderCircle className="size-5 animate-spin text-slate-800" aria-hidden="true" />
                  ) : (
                    <Circle className="size-5 text-slate-300" aria-hidden="true" />
                  )}
                  <span className={active ? 'font-medium text-slate-950' : ''}>{step.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {generation.error ? (
        <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs leading-5 text-rose-700">
          {generation.error}
        </div>
      ) : null}
    </aside>
  );
}
