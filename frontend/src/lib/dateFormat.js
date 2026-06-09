/**
 * Locale-aware date/time formatting for ToolShare.
 * Accepts ISO date strings (YYYY-MM-DD) or full ISO datetimes.
 */
export function formatDate(value, lang = "en") {
  if (!value) return "";
  try {
    // For YYYY-MM-DD only, parse as local date to avoid timezone shifts
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
    return new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return value;
  }
}

export function formatDateShort(value, lang = "en") {
  if (!value) return "";
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
    return new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return value;
  }
}

export function formatTime(value, lang = "en") {
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

export function formatDateTime(value, lang = "en") {
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
 * "Jun 5 – 7, 2026" (en) | "5 – 7 juin 2026" (fr) | "5 – 7 jun 2026" (es)
 */
export function formatDateRange(startVal, endVal, lang = "en") {
  if (!startVal || !endVal) return `${startVal || ""} → ${endVal || ""}`;
  try {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(startVal) ? new Date(`${startVal}T00:00:00`) : new Date(startVal);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(endVal) ? new Date(`${endVal}T00:00:00`) : new Date(endVal);
    if (typeof Intl.DateTimeFormat.prototype.formatRange === "function") {
      return new Intl.DateTimeFormat(lang, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).formatRange(start, end);
    }
    return `${formatDate(startVal, lang)} → ${formatDate(endVal, lang)}`;
  } catch {
    return `${startVal} → ${endVal}`;
  }
}
