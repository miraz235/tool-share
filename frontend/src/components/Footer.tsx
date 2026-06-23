import { useTranslation } from "react-i18next";
import { Wrench } from "lucide-react";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-brand-border bg-brand-bg mt-24">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-extrabold text-xl">ShareMyKit</span>
          </div>
          <p className="text-brand-muted text-sm max-w-md">{t("landing.footer_about")}</p>
        </div>
        <div>
          <div className="font-heading font-semibold text-brand-text mb-3">{t("landing.footer_marketplace")}</div>
          <ul className="space-y-2 text-sm text-brand-muted">
            <li>{t("landing.footer_browse_tools")}</li>
            <li>{t("landing.footer_categories")}</li>
            <li>{t("nav.ai_assistant")}</li>
          </ul>
        </div>
        <div>
          <div className="font-heading font-semibold text-brand-text mb-3">{t("landing.footer_company")}</div>
          <ul className="space-y-2 text-sm text-brand-muted">
            <li>{t("landing.footer_how")}</li>
            <li>{t("landing.footer_trust")}</li>
            <li>{t("landing.footer_help")}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-4 text-xs text-brand-muted flex justify-between">
          <span>{t("landing.footer_copy")}</span>
          <span>{t("landing.footer_made")}</span>
        </div>
      </div>
    </footer>
  );
}
