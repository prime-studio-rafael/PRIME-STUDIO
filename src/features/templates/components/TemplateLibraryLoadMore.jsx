import { Loader2 } from 'lucide-react';

export default function TemplateLibraryLoadMore({ hasMore, loading, error, onLoadMore }) {
  if (!hasMore) return null;
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        Carregar mais
      </button>
    </div>
  );
}
