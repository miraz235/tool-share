import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { LANGUAGES } from "@/i18n";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export default function LanguageSwitcher({ compact = false }) {
  const { i18n, t } = useTranslation();
  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const change = (code) => {
    i18n.changeLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="lang-switcher"
        className="outline-none px-3 h-9 rounded-xl border border-brand-border bg-white hover:bg-brand-subtle text-sm font-medium flex items-center gap-1.5 transition-colors">
        <Globe className="w-3.5 h-3.5 text-brand-muted" />
        {compact ? current.code.toUpperCase() : <><span>{current.flag}</span><span className="hidden sm:inline">{current.label}</span></>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-brand-muted">{t("lang.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map(l => (
          <DropdownMenuItem key={l.code} onClick={() => change(l.code)}
            data-testid={`lang-${l.code}`}
            className={`gap-2 ${l.code === current.code ? 'bg-brand-primary/10 text-brand-primary font-semibold' : ''}`}>
            <span>{l.flag}</span> <span>{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
