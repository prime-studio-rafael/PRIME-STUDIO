import { ImageOff } from 'lucide-react';

export default function ComparisonGrid({ template, garmentPreviewUrl, result, aspectRatio = '1:1' }) {
  const items = [
    { label: 'Modelo-base', src: template?.publicUrl, alt: template?.label },
    { label: 'Roupa enviada', src: garmentPreviewUrl, alt: 'Roupa superior enviada' },
    { label: 'Resultado gerado', src: result.image.dataUrl, alt: 'Resultado gerado pela IA' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <figure key={item.label} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <figcaption className="text-xs font-semibold text-slate-700">{item.label}</figcaption>
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{aspectRatio}</span>
          </div>
          <div className="min-h-[220px] bg-slate-100" style={{ aspectRatio: aspectRatio.replace(':', ' / ') }}>
            {item.src ? <img src={item.src} alt={item.alt} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-slate-400"><ImageOff size={24} /></div>}
          </div>
        </figure>
      ))}
    </div>
  );
}
