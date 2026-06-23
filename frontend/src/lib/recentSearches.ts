/**
 * Recently-searched persistence for the Browse page.
 *
 * Snapshots the user-meaningful URL params (search query, category, listing
 * type, location filters, max price, verified flag) into localStorage so we
 * can re-apply them with one click.
 *
 * Capped at 3 to keep the UI uncluttered.
 */

const STORAGE_KEY = "toolshare_recent_searches";
const MAX_RECENT = 3;

/** Keys that we treat as part of a "search" — others (radius/zoom/etc) are ignored. */
const TRACKED_KEYS = [
  "q",
  "category",
  "listing_type",
  "city",
  "state",
  "postal_code",
  "max_price",
  "verified_only",
] as const;

export interface RecentSearch {
  /** Stable hash of the URL params so we can dedupe. */
  id: string;
  /** Short human-readable summary for the chip. */
  label: string;
  /** Serialized URLSearchParams string we can re-apply directly. */
  params: string;
  /** Unix ms; newer first. */
  savedAt: number;
}

/** Build a chip label like `"Saw · Toronto · ≤ 40"`. */
function buildLabel(params: URLSearchParams, t?: (k: string, dflt?: string) => string): string {
  const parts: string[] = [];
  const tx = t || ((_k, d) => d || _k);
  if (params.get("q")) parts.push(params.get("q") as string);
  if (params.get("category") && params.get("category") !== "all") parts.push(params.get("category") as string);
  if (params.get("listing_type") === "sell") parts.push(tx("browse.type_sell", "Buy"));
  if (params.get("listing_type") === "rent") parts.push(tx("browse.type_rent", "Rent"));
  if (params.get("city")) parts.push(params.get("city") as string);
  if (params.get("state")) parts.push(params.get("state") as string);
  if (params.get("postal_code")) parts.push(params.get("postal_code") as string);
  if (params.get("max_price")) parts.push(`≤ ${params.get("max_price")}`);
  if (params.get("verified_only") === "true") parts.push(tx("common.verified", "Verified"));
  return parts.join(" · ");
}

/** Returns a URLSearchParams containing only the tracked keys. */
function pickTracked(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  TRACKED_KEYS.forEach((k) => {
    const v = params.get(k);
    if (v) out.set(k, v);
  });
  return out;
}

export function listRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(
  params: URLSearchParams,
  t?: (k: string, dflt?: string) => string
): RecentSearch[] {
  const tracked = pickTracked(params);
  // Skip empty searches and the "Verified only by itself" non-search.
  if ([...tracked.keys()].length === 0) return listRecentSearches();
  const id = tracked.toString();
  const label = buildLabel(tracked, t);
  if (!label) return listRecentSearches();
  const entry: RecentSearch = { id, label, params: tracked.toString(), savedAt: Date.now() };
  const existing = listRecentSearches().filter((r) => r.id !== id);
  const next = [entry, ...existing].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
