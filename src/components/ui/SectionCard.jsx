export default function SectionCard({ eyebrow, title, description, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-6 ${className}`}>
      {(eyebrow || title || description) && (
        <div className="mb-5">
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>}
          {title && <h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-950">{title}</h2>}
          {description && <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
