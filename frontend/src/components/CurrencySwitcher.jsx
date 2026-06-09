import { useCurrency, CURRENCIES } from "@/lib/currency";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { DollarSign } from "lucide-react";

export default function CurrencySwitcher() {
  const { currency, change } = useCurrency();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="currency-switcher"
        className="outline-none px-3 h-9 rounded-xl border border-brand-border bg-white hover:bg-brand-subtle text-sm font-medium flex items-center gap-1.5 transition-colors">
        <DollarSign className="w-3.5 h-3.5 text-brand-muted" />
        <span>{currency}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-brand-muted">Currency</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CURRENCIES.map(c => (
          <DropdownMenuItem key={c.code} onClick={() => change(c.code)}
            data-testid={`currency-${c.code}`}
            className={`gap-2 ${c.code === currency ? 'bg-brand-primary/10 text-brand-primary font-semibold' : ''}`}>
            <span>{c.flag}</span> <span>{c.code}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
