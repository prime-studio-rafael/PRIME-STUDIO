export default function TemplateTagList({ tags = [], max = 3, className = '' }) {
  if (!tags.length) return null;
  const visible = tags.slice(0, max);
  const remaining = tags.length - visible.length;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {visible.map((tag) => (
        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{tag}</span>
      ))}
      {remaining > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">+{remaining}</span>}
    </div>
  );
}
