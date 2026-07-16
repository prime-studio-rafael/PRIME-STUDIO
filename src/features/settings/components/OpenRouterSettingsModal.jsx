import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert, Trash2, X } from 'lucide-react';
import {
  deleteOpenRouterKey,
  fetchOpenRouterKeyStatus,
  saveOpenRouterKey,
  testOpenRouterKey,
} from '../api/openRouterSettingsClient.js';

const initialStatus = { configured: false, source: 'none' };

export default function OpenRouterSettingsModal({ open, onClose, onStatusChange }) {
  const [status, setStatus] = useState(initialStatus);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!open) return undefined;
    let ignore = false;
    setFeedback(null);
    fetchOpenRouterKeyStatus()
      .then((nextStatus) => {
        if (ignore) return;
        setStatus(nextStatus);
        onStatusChangeRef.current(nextStatus);
      })
      .catch((error) => {
        if (ignore) return;
        setFeedback({ type: 'error', message: error.message, code: error.code });
      });
    return () => {
      ignore = true;
    };
  }, [open]);

  if (!open) return null;

  const keyAlreadySaved = status.source === 'keychain';
  const visualStatus = getVisualStatus(status, feedback);

  async function handleSave(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      const nextStatus = await saveOpenRouterKey(apiKey);
      setApiKey('');
      setShowKey(false);
      setStatus(nextStatus);
      setFeedback({ type: 'success', message: nextStatus.message });
      onStatusChange(nextStatus);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message, code: error.code });
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    if (loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      const result = await testOpenRouterKey();
      setFeedback({ type: result.valid ? 'valid' : 'invalid', message: result.message });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message, code: error.code });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (loading || !window.confirm('Remover a chave salva no Chaves do macOS? O fallback do .env, se existir, não será alterado.')) return;
    setLoading(true);
    setFeedback(null);
    try {
      const nextStatus = await deleteOpenRouterKey();
      setApiKey('');
      setStatus(nextStatus);
      setFeedback({ type: 'success', message: nextStatus.message });
      onStatusChange(nextStatus);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message, code: error.code });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-4 backdrop-blur-sm sm:items-center sm:justify-center" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="openrouter-settings-title" className="w-full max-w-xl rounded-2xl border border-slate-200 bg-[#f7f7f8] shadow-2xl shadow-slate-950/20">
        <header className="flex items-start justify-between gap-5 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><KeyRound size={18} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Configurações</p>
              <h2 id="openrouter-settings-title" className="mt-1 text-lg font-semibold tracking-[-0.025em] text-slate-950">OpenRouter</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">A chave é guardada localmente no Chaves do macOS e nunca retorna para o navegador.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950" aria-label="Fechar configurações"><X size={18} /></button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <StatusBanner status={visualStatus} />

          <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="openrouter-api-key" className="text-sm font-semibold text-slate-900">API Key do OpenRouter</label>
            <p className="mt-1 text-xs leading-5 text-slate-500">Cole a chave apenas para salvá-la. Depois disso, o campo fica vazio e a chave não é exibida novamente.</p>
            <div className="mt-3 flex gap-2">
              <input
                id="openrouter-api-key"
                type={showKey && !keyAlreadySaved ? 'text' : 'password'}
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={keyAlreadySaved ? 'Digite uma nova chave para substituir a atual' : 'Cole a chave do OpenRouter'}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              />
              {!keyAlreadySaved && (
                <button type="button" onClick={() => setShowKey((current) => !current)} className="rounded-xl border border-slate-200 px-3 text-slate-600 transition hover:border-slate-400 hover:text-slate-950" aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}>
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            <button type="submit" disabled={loading || !apiKey.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Salvar chave
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={loading || !status.configured} onClick={handleTest} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-400">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Testar conexão
            </button>
            <button type="button" disabled={loading || !keyAlreadySaved} onClick={handleDelete} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-400">
              <Trash2 size={16} /> Remover chave
            </button>
          </div>

          {feedback && <FeedbackMessage feedback={feedback} />}
        </div>
      </section>
    </div>
  );
}

function getVisualStatus(status, feedback) {
  if (feedback?.type === 'valid') return { tone: 'valid', label: 'Chave válida' };
  if (feedback?.type === 'invalid') return { tone: 'invalid', label: 'Chave inválida' };
  if (feedback?.code === 'KEYCHAIN_ACCESS_ERROR') return { tone: 'error', label: 'Erro ao acessar o Keychain' };
  if (status.source === 'keychain') return { tone: 'saved', label: 'Chave salva' };
  if (status.configured) return { tone: 'saved', label: 'Chave configurada via .env' };
  return { tone: 'missing', label: 'Chave não configurada' };
}

function StatusBanner({ status }) {
  const classes = {
    valid: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    saved: 'border-sky-200 bg-sky-50 text-sky-800',
    invalid: 'border-rose-200 bg-rose-50 text-rose-800',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    missing: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  const Icon = status.tone === 'missing' || status.tone === 'invalid' || status.tone === 'error' ? ShieldAlert : CheckCircle2;
  return <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${classes[status.tone]}`}><Icon size={17} /> {status.label}</div>;
}

function FeedbackMessage({ feedback }) {
  const tone = feedback.type === 'success' || feedback.type === 'valid' ? 'text-emerald-700' : 'text-rose-700';
  return <p role="status" className={`rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-5 ${tone}`}>{feedback.message}</p>;
}
