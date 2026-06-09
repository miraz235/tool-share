/**
 * Locale-aware date/time formatting for ToolShare.
 * Accepts ISO date strings (YYYY-MM-DD) or full ISO datetimes.
 */
type AnyValue = string | null | undefined;

function parse(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
}

export function formatDate(value: AnyValue, lang: string = "en"): string {
  if (!value) return "";
  try {
    const d = parse(value);
    return new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return value;
  }
}

export function formatDateShort(value: AnyValue, lang: string = "en"): string {
  if (!value) return "";
  try {
    const d = parse(value);
    return new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return value;
  }
}

export function formatTime(value: AnyValue, lang: string = "en"): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat(lang, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return value;
  }
}

export function formatDateTime(value: AnyValue, lang: string = "en"): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return value;
  }
}

/**
 * Formats a date range "start → end". Collapses to a single month/year when same.
 */
export function formatDateRange(startVal: AnyValue, endVal: AnyValue, lang: string = "en"): string {
  if (!startVal || !endVal) return `${startVal || ""} → ${endVal || ""}`;
  try {
    const start = parse(startVal);
    const end = parse(endVal);
    const fmt = new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    // formatRange is a relatively recent Intl API — guard against environments that lack it.
    const maybeRange = (fmt as Intl.DateTimeFormat & {
      formatRange?: (a: Date, b: Date) => string;
    }).formatRange;
    if (typeof maybeRange === "function") {
      return maybeRange.call(fmt, start, end);
    }
    return `${formatDate(startVal, lang)} → ${formatDate(endVal, lang)}`;
  } catch {
    return `${startVal} → ${endVal}`;
  }
}
