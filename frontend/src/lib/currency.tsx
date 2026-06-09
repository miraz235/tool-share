import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from "react";
import { api } from "./api";

interface CurrencyDef {
  code: string;
  flag: string;
  symbol: string;
  /** Languages where this currency is typically shown (used as Intl locale fallback). */
  locale?: string;
}

interface CurrencyContextValue {
  currency: string;
  change: (code: string) => void;
  format: (usdAmount: number | null | undefined, opts?: { maxDigits?: number; lang?: string }) => string;
  rates: Record<string, number>;
  detecting: boolean;
}

const CurrencyCtx = createContext<CurrencyContextValue | null>(null);

const STORAGE_KEY = "toolshare_currency";
export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", flag: "🇺🇸", symbol: "$", locale: "en-US" },
  { code: "CAD", flag: "🇨🇦", symbol: "$", locale: "en-CA" },
  { code: "EUR", flag: "🇪🇺", symbol: "€", locale: "fr-FR" },
  { code: "GBP", flag: "🇬🇧", symbol: "£", locale: "en-GB" },
  { code: "MXN", flag: "🇲🇽", symbol: "$", locale: "es-MX" },
  { code: "AUD", flag: "🇦🇺", symbol: "$", locale: "en-AU" },
];

// ISO-3166 country → currency code (for geo-IP defaulting). Only US/CA in scope for now,
// but the broader map covers North America + a few popular fallbacks.
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  GB: "GBP",
  AU: "AUD",
  // EU member states default to EUR
  FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", BE: "EUR", NL: "EUR",
  AT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", MT: "EUR", SI: "EUR",
  SK: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR", HR: "EUR",
};

const DEFAULT_RATES: Record<string, number> = {
  USD: 1, CAD: 1.37, EUR: 0.92, GBP: 0.79, MXN: 17.4, AUD: 1.52,
};

async function detectCurrencyFromIP(): Promise<string | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { country_code?: string; country?: string; currency?: string };
    // Prefer the API's directly-reported currency code when it's one we support.
    if (data.currency && CURRENCIES.some((c) => c.code === data.currency)) {
      return data.currency;
    }
    const cc = (data.country_code || data.country || "").toUpperCase();
    return COUNTRY_TO_CURRENCY[cc] || null;
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "USD"; } catch { return "USD"; }
  });
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES);
  const [detecting, setDetecting] = useState<boolean>(false);

  // Fetch live FX rates (backend cache, fallback to defaults on error)
  useEffect(() => {
    api.get<{ rates: Record<string, number> }>("/fx/rates")
      .then((r) => setRates({ ...DEFAULT_RATES, ...r.data.rates }))
      .catch(() => { /* keep defaults */ });
  }, []);

  // First-visit geo-IP detection: only runs if user hasn't picked one yet.
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (stored) return; // user/prior visit already chose
    setDetecting(true);
    detectCurrencyFromIP()
      .then((detected) => {
        if (detected) {
          setCurrency(detected);
          try { localStorage.setItem(STORAGE_KEY, detected); } catch { /* ignore */ }
        }
      })
      .finally(() => setDetecting(false));
  }, []);

  const change = useCallback((code: string) => {
    setCurrency(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }, []);

  const format = useCallback((usdAmount: number | null | undefined, opts: { maxDigits?: number; lang?: string } = {}): string => {
    if (usdAmount === null || usdAmount === undefined) return "";
    const rate = rates[currency] ?? 1;
    const converted = Number(usdAmount) * rate;
    const lang = opts.lang
      || CURRENCIES.find((c) => c.code === currency)?.locale
      || (typeof navigator !== "undefined" ? navigator.language : "en");
    try {
      return new Intl.NumberFormat(lang, {
        style: "currency",
        currency,
        maximumFractionDigits: opts.maxDigits ?? 0,
      }).format(converted);
    } catch {
      return `${currency} ${converted.toFixed(0)}`;
    }
  }, [currency, rates]);

  const value = useMemo<CurrencyContextValue>(
    () => ({ currency, change, format, rates, detecting }),
    [currency, change, format, rates, detecting]
  );

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export const useCurrency = (): CurrencyContextValue => {
  const ctx = useContext(CurrencyCtx);
  if (!ctx) {
    // Graceful fallback when the provider isn't mounted (e.g., isolated Storybook).
    return {
      currency: "USD",
      change: () => { /* no-op */ },
      format: (n) => (n == null ? "" : `$${Number(n).toFixed(0)}`),
      rates: DEFAULT_RATES,
      detecting: false,
    };
  }
  return ctx;
};
