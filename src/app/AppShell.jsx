import Sidebar from '../components/layout/Sidebar.jsx';

export default function AppShell({ keyConfigured, onOpenSettings, children }) {
  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col sm:flex-row">
        <Sidebar keyConfigured={keyConfigured} onOpenSettings={onOpenSettings} />
        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-11">{children}</main>
      </div>
    </div>
  );
}
