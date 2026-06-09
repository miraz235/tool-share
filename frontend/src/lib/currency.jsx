import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { api } from "./api";

const CurrencyCtx = createContext(null);

const STORAGE_KEY = "toolshare_currency";
export const CURRENCIES = [
  { code: "USD", flag: "🇺🇸", symbol: "$" },
  { code: "CAD", flag: "🇨🇦", symbol: "$" },
];

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "USD"; } catch { return "USD"; }
  });
  const [rates, setRates] = useState({ USD: 1, CAD: 1.37 });

  useEffect(() => {
    api.get("/fx/rates").then(r => setRates(r.data.rates)).catch(() => {});
  }, []);

  const change = useCallback((code) => {
    setCurrency(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  }, []);

  const format = useCallback((usdAmount, opts = {}) => {
    if (usdAmount === null || usdAmount === undefined) return "";
    const rate = rates[currency] || 1;
    const converted = Number(usdAmount) * rate;
    const lang = opts.lang || (typeof navigator !== "undefined" ? navigator.language : "en");
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

  const value = useMemo(() => ({ currency, change, format, rates }), [currency, change, format, rates]);

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export const useCurrency = () => useContext(CurrencyCtx);
