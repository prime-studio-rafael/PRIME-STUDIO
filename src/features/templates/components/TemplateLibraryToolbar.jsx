import { Search } from 'lucide-react';
import { ALL_CATEGORIES } from '../hooks/useTemplateLibraryFilters.js';

export default function TemplateLibraryToolbar({ categories, search, onSearchChange, category, onCategoryChange }) {
  return (
    <div className="mb-6 space-y-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nome ou tag…"
          aria-label="Buscar templates"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500"
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
        <button
          type="button"
          onClick={() => onCategoryChange(ALL_CATEGORIES)}
          aria-pressed={category === ALL_CATEGORIES}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${category === ALL_CATEGORIES ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
        >
          Todas
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onCategoryChange(item.id)}
            aria-pressed={category === item.id}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${category === item.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
          >
            {item.emoji ? `${item.emoji} ` : ''}{item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
