export default function TemplateCategorySelect({ categories, value, onChange, disabled, id = 'template-category-input' }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-100"
    >
      {categories.map((category) => (
        <option key={category.id} value={category.id}>{category.emoji ? `${category.emoji} ` : ''}{category.label}</option>
      ))}
    </select>
  );
}
