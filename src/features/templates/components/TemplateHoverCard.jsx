import { useState } from 'react';
import { Info } from 'lucide-react';
import TemplateTagList from './TemplateTagList.jsx';

export default function TemplateHoverCard({ label, tags = [], hoverDescription, fallbackDescription, disabled }) {
  const [visible, setVisible] = useState(false);
  const text = hoverDescription || fallbackDescription;
  if (!text && !tags.length) return null;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button type="button" disabled={disabled} aria-label={`Mais detalhes sobre ${label}`} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40">
        <Info size={14} />
      </button>
      {visible && (
        <div role="tooltip" className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-[0_12px_36px_rgba(15,23,42,0.12)]">
          {text && <p className="leading-5">{text}</p>}
          {tags.length > 0 && <TemplateTagList tags={tags} className="mt-2" />}
        </div>
      )}
    </span>
  );
}
