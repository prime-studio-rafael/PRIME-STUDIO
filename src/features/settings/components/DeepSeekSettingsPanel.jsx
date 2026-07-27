import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { removeDeepSeekKey, saveDeepSeekKey, testDeepSeekKey, updateDeepSeekSettings } from '../api/aiSettingsClient.js';

export default function DeepSeekSettingsPanel({ provider, onChange }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const configured = Boolean(provider?.configured);

  async function run(action, operation) {
    if (loading) return;
    setLoading(action); setFeedback(null);
    try { await operation(); }
    catch (error) { setFeedback({ type: 'error', message: error.message }); }
    finally { setLoading(null); }
  }

  function handleSave(event) {
    event.preventDefault();
    if (configured && !window.confirm('Substituir a chave DeepSeek salva no Chaves do macOS?')) return;
    run('save', async () => {
      const next = await saveDeepSeekKey(apiKey);
      setApiKey(''); setShowKey(false); onChange(next);
      setFeedback({ type: 'success', message: next.message });
    });
  }

  function handleTest() {
    run('test', async () => {
      const result = await testDeepSeekKey(); onChange(result.provider);
      setFeedback({ type: result.valid ? 'success' : 'error', message: result.message });
    });
  }

  function handleRemove() {
    if (!window.confirm('Remover a chave DeepSeek salva no Chaves do macOS?')) return;
    run('remove', async () => {
      const next = await removeDeepSeekKey(); onChange(next);
      setApiKey(''); setFeedback({ type: 'success', message: next.message });
    });
  }

  function handleModel(event) {
    const modelId = event.target.value;
    run('model', async () => onChange(await updateDeepSeekSettings(modelId)));
  }

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${configured ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {configured ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />}{configured ? 'Chave salva' : 'Chave não configurada'}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="deepseek-model" className="text-sm font-semibold text-slate-900">Modelo</label>
        <p className="mt-1 text-xs text-slate-500">Textos criativos para Stories</p>
        <select id="deepseek-model" value={provider?.modelId || 'deepseek-v4-flash'} onChange={handleModel} disabled={Boolean(loading)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
          {(provider?.models || [{ id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' }]).map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
      </div>
      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="deepseek-api-key" className="text-sm font-semibold text-slate-900">API Key do DeepSeek</label>
        <p className="mt-1 text-xs leading-5 text-slate-500">A chave será salva no Chaves do macOS e nunca será exibida novamente.</p>
        <div className="mt-3 flex gap-2">
          <input id="deepseek-api-key" type={showKey ? 'text' : 'password'} autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={configured ? 'Digite uma nova chave para substituir a atual' : 'Cole a chave do DeepSeek'} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs" />
          <button type="button" onClick={() => setShowKey((value) => !value)} className="rounded-xl border border-slate-200 px-3 text-slate-600" aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <button type="submit" disabled={Boolean(loading) || !apiKey.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400">{loading === 'save' ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}Salvar chave</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={Boolean(loading) || !configured} onClick={handleTest} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold disabled:text-slate-400">{loading === 'test' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}Testar conexão</button>
        <button type="button" disabled={Boolean(loading) || !configured} onClick={handleRemove} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 disabled:text-slate-400"><Trash2 size={16} />Remover chave</button>
      </div>
      {feedback && <p role="status" className={`rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm ${feedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{feedback.message}</p>}
    </div>
  );
}
