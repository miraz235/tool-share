import { Wrench } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-brand-border bg-brand-bg mt-24">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-extrabold text-xl">ToolShare</span>
          </div>
          <p className="text-brand-muted text-sm max-w-md">
            Rent tools from your neighbours. Build, fix, and create — without owning everything.
            ToolShare is a community marketplace for North America.
          </p>
        </div>
        <div>
          <div className="font-heading font-semibold text-brand-text mb-3">Marketplace</div>
          <ul className="space-y-2 text-sm text-brand-muted">
            <li>Browse tools</li>
            <li>Categories</li>
            <li>AI Assistant</li>
          </ul>
        </div>
        <div>
          <div className="font-heading font-semibold text-brand-text mb-3">Company</div>
          <ul className="space-y-2 text-sm text-brand-muted">
            <li>How it works</li>
            <li>Trust & Safety</li>
            <li>Help center</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-4 text-xs text-brand-muted flex justify-between">
          <span>© 2026 ToolShare. Built for neighbours.</span>
          <span>Made in North America</span>
        </div>
      </div>
    </footer>
  );
}
