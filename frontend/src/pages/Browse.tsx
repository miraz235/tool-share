// @ts-nocheck
// TODO: convert shadcn UI primitives (.jsx) to .tsx for full type safety.
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import ToolCard from "@/components/ToolCard";
import MapView from "@/components/MapView";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Map as MapIcon, List as ListIcon, Search, SlidersHorizontal, Compass, Loader2, Crosshair, X } from "lucide-react";
import type { Tool, ListingType } from "@/types";
import { useCurrency } from "@/lib/currency";

const DEFAULT_RADIUS = 50;
const MAX_PRICE = 500;
const STORAGE_KEY = "toolshare_browse_filters";

interface MapSearchHintProps {
  searchCenter: { source: "user" | "map" } | null;
  userLocationAvailable: boolean;
  onRecenter: () => void;
}

function MapSearchHint({ searchCenter, userLocationAvailable, onRecenter }: MapSearchHintProps) {
  // Only show the "back to my location" affordance once the user has moved the map
  if (!searchCenter || searchCenter.source !== "map") return null;
  return (
    <div
      className="absolute top-7 left-1/2 -translate-x-1/2 z-[400] bg-white/95 backdrop-blur shadow-md rounded-full border border-brand-border px-4 py-2 flex items-center gap-2 text-xs font-semibold pointer-events-auto"
      data-testid="map-search-hint"
    >
      <span className="text-brand-text">{`Showing tools in this map area`}</span>
      {userLocationAvailable && (
        <button
          onClick={onRecenter}
          data-testid="map-recenter-btn"
          className="flex items-center gap-1 text-brand-primary hover:text-brand-primary-hover transition-colors"
        >
          <Crosshair className="w-3.5 h-3.5" />
          Use my location
        </button>
      )}
    </div>
  );
}

type ListingTypeFilter = ListingType | "all";

interface SavedFilters {
  max_price?: number | null;
  radius_km?: number | null;
  listing_type?: ListingType | null;
}

interface CategoryItem {
  slug: string;
  name: string;
}

interface UserCoords {
  lat: number;
  lng: number;
}

interface SearchCenter {
  lat: number;
  lng: number;
  /** "user" = from device geolocation, "map" = user moved the map */
  source: "user" | "map";
}

function loadSavedFilters(): SavedFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFilters) : {};
  } catch {
    return {};
  }
}

function saveFilters(patch: SavedFilters): void {
  try {
    const prev = loadSavedFilters();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* ignore */
  }
}

export default function Browse() {
  const { t } = useTranslation();
  const { currency: viewerCurrency } = useCurrency();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [view, setView] = useState<"split" | "grid" | "map">("split");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserCoords | null>(null);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(null);

  // On mount: if URL has no filter params, hydrate from localStorage
  useEffect(() => {
    const saved = loadSavedFilters();
    const p = new URLSearchParams(params);
    let changed = false;
    if (!p.has("max_price") && saved.max_price && saved.max_price < MAX_PRICE) {
      p.set("max_price", String(saved.max_price));
      changed = true;
    }
    if (!p.has("radius_km") && saved.radius_km && saved.radius_km !== DEFAULT_RADIUS) {
      p.set("radius_km", String(saved.radius_km));
      changed = true;
    }
    if (!p.has("listing_type") && saved.listing_type) {
      p.set("listing_type", saved.listing_type);
      changed = true;
    }
    if (changed) setParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = params.get("q") || "";
  const category = params.get("category") || "all";
  const city = params.get("city") || "";
  const stateFilter = params.get("state") || "";
  const postal = params.get("postal_code") || "";
  const listingType = (params.get("listing_type") || "all") as ListingTypeFilter;

  const [maxPriceUI, setMaxPriceUI] = useState<number>(
    parseInt(params.get("max_price") || String(MAX_PRICE), 10)
  );
  const [radiusUI, setRadiusUI] = useState<number>(
    parseInt(params.get("radius_km") || String(DEFAULT_RADIUS), 10)
  );
  const maxPrice = parseInt(params.get("max_price") || String(MAX_PRICE), 10);
  const radiusKm = parseInt(params.get("radius_km") || String(DEFAULT_RADIUS), 10);

  useEffect(() => { saveFilters({ max_price: maxPrice }); }, [maxPrice]);
  useEffect(() => { saveFilters({ radius_km: radiusKm }); }, [radiusKm]);
  useEffect(() => {
    saveFilters({ listing_type: listingType === "all" ? null : listingType });
  }, [listingType]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        // Seed map-search center with user position so the first search is local
        setSearchCenter((prev) => prev ?? { ...coords, source: "user" });
        setGeoLoading(false);
      },
      () => { setGeoLoading(false); },
      { maximumAge: 5 * 60 * 1000, timeout: 8000 }
    );
  }, []);

  // When the user pans/zooms the map, recenter the search.
  // Keep the user's explicit radius_km slider value as source of truth — we ONLY
  // adopt the map-derived radius when the user hasn't yet touched the slider
  // (i.e. there is no `radius_km` in the URL).
  const handleMapMove = (lat: number, lng: number, derivedRadiusKm: number) => {
    setSearchCenter({ lat, lng, source: "map" });
    if (!params.has("radius_km")) {
      setRadiusUI(derivedRadiusKm);
      const p = new URLSearchParams(params);
      p.set("radius_km", String(derivedRadiusKm));
      setParams(p, { replace: true });
    }
  };

  const recenterToMyLocation = () => {
    if (userLocation) {
      setSearchCenter({ ...userLocation, source: "user" });
    } else {
      requestGeo();
    }
  };

  useEffect(() => {
    api.get<CategoryItem[]>("/categories")
      .then((r) => setCategories(r.data))
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    setLoading(true);
    const queryParams: Record<string, string | number> = {};
    if (q) queryParams.q = q;
    if (category && category !== "all") queryParams.category = category;
    if (city) queryParams.city = city;
    if (stateFilter) queryParams.state = stateFilter;
    if (postal) queryParams.postal_code = postal;
    if (listingType && listingType !== "all") queryParams.listing_type = listingType;
    if (maxPrice && maxPrice < MAX_PRICE) {
      queryParams.max_price = maxPrice;
      queryParams.viewer_currency = viewerCurrency;
    }
    // Prefer the user-driven map center when present; otherwise fall back to device geolocation
    const effectiveCenter = searchCenter ?? (userLocation ? { ...userLocation, source: "user" as const } : null);
    if (effectiveCenter) {
      queryParams.lat = effectiveCenter.lat;
      queryParams.lng = effectiveCenter.lng;
      queryParams.radius_km = radiusKm;
    }
    api.get<Tool[]>("/tools", { params: queryParams })
      .then((r) => setTools(r.data))
      .finally(() => setLoading(false));
  }, [q, category, city, stateFilter, postal, listingType, maxPrice, radiusKm, userLocation, searchCenter, viewerCurrency]);

  const updateParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v && v !== "all") p.set(k, v); else p.delete(k);
    setParams(p);
  };

  const requestGeo = (): void => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setSearchCenter({ ...coords, source: "user" });
        setGeoLoading(false);
      },
      () => { setGeoLoading(false); }
    );
  };

  const mapCenter: [number, number] | undefined = searchCenter
    ? [searchCenter.lat, searchCenter.lng]
    : userLocation
      ? [userLocation.lat, userLocation.lng]
      : undefined;

  // Filters surfaced inside the popover — drives the active-filter badge + chips.
  const popoverFilters = [
    { key: "city", label: t("common.city"), value: city },
    { key: "state", label: t("common.state", "State"), value: stateFilter },
    { key: "postal_code", label: t("common.postal_code", "ZIP"), value: postal },
    { key: "max_price", label: t("browse.filters_max_price", "Max price"),
      value: maxPrice < MAX_PRICE ? `≤ ${maxPrice}` : "" },
    { key: "radius_km", label: t("browse.filters_radius", "Distance"),
      value: params.has("radius_km") && radiusKm !== DEFAULT_RADIUS ? `${radiusKm} km` : "" },
  ];
  const activeFilterCount = popoverFilters.filter((f) => !!f.value).length;
  const activeFilterChips = popoverFilters
    .filter((f) => !!f.value)
    .map((f) => ({
      ...f,
      onClear: () => {
        const next = new URLSearchParams(params);
        next.delete(f.key);
        setParams(next);
      },
    }));

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* Filter bar */}
      <div className="border-b border-brand-border bg-white sticky top-16 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md bg-brand-subtle rounded-xl px-3">
            <Search className="w-4 h-4 text-brand-muted" />
            <Input
              data-testid="browse-search-input"
              placeholder={`${t("common.search")}...`}
              defaultValue={q}
              onKeyDown={(e) => { if (e.key === "Enter") updateParam("q", e.currentTarget.value); }}
              className="border-0 bg-transparent focus-visible:ring-0 px-0 h-10"
            />
          </div>

          {/* Category */}
          <Select value={category} onValueChange={(v) => updateParam("category", v)}>
            <SelectTrigger className="w-44 rounded-xl" data-testid="browse-category-select">
              <SelectValue placeholder={t("common.all_categories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all_categories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>{t(`categories.${c.slug}`, c.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Rent vs Buy toggle */}
          <div className="flex gap-0.5 bg-brand-subtle rounded-xl p-0.5" data-testid="browse-listing-type">
            {([
              { v: "all", label: t("browse.type_all") },
              { v: "rent", label: t("browse.type_rent") },
              { v: "sell", label: t("browse.type_sell") },
            ] as Array<{ v: ListingTypeFilter; label: string }>).map((o) => (
              <button
                key={o.v}
                onClick={() => updateParam("listing_type", o.v)}
                data-testid={`listing-type-${o.v}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${listingType === o.v ? "bg-white text-brand-text shadow-sm" : "text-brand-muted"}`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Advanced filters popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="browse-filters-btn"
                className="rounded-xl border-brand-border h-10 px-3 gap-2 relative"
                onMouseEnter={() => { if (!userLocation && !geoLoading) requestGeo(); }}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="font-medium">{t("browse.filters", "Filters")}</span>
                {activeFilterCount > 0 && (
                  <span
                    data-testid="browse-active-filter-count"
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={8}
              className="w-[360px] rounded-2xl border-brand-border p-5 space-y-5"
              data-testid="browse-filters-popover"
            >
              {/* Location */}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-brand-muted mb-2">
                  {t("browse.filters_location", "Location")}
                </div>
                <div className="space-y-2">
                  <Input
                    data-testid="browse-city-input"
                    placeholder={t("common.city")}
                    defaultValue={city}
                    onKeyDown={(e) => { if (e.key === "Enter") updateParam("city", e.currentTarget.value); }}
                    onBlur={(e) => { if (e.currentTarget.value !== city) updateParam("city", e.currentTarget.value); }}
                    className="rounded-xl"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      data-testid="browse-state-input"
                      placeholder={t("common.state", "State / Province")}
                      defaultValue={stateFilter}
                      onKeyDown={(e) => { if (e.key === "Enter") updateParam("state", e.currentTarget.value); }}
                      onBlur={(e) => { if (e.currentTarget.value !== stateFilter) updateParam("state", e.currentTarget.value); }}
                      className="rounded-xl"
                    />
                    <Input
                      data-testid="browse-postal-input"
                      placeholder={t("common.postal_code", "ZIP / Postal")}
                      defaultValue={postal}
                      onKeyDown={(e) => { if (e.key === "Enter") updateParam("postal_code", e.currentTarget.value); }}
                      onBlur={(e) => { if (e.currentTarget.value !== postal) updateParam("postal_code", e.currentTarget.value); }}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Max price */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-brand-muted">
                    {t("browse.filters_max_price", "Max price")}
                  </span>
                  <span className="text-sm font-semibold text-brand-text" data-testid="browse-max-price-value">
                    {maxPriceUI >= MAX_PRICE ? t("browse.any", "Any") : t("browse.max_price", { value: maxPriceUI })}
                  </span>
                </div>
                <Slider
                  value={[maxPriceUI]}
                  onValueChange={(v) => setMaxPriceUI(v[0])}
                  onValueCommit={(v) => updateParam("max_price", v[0] >= MAX_PRICE ? "" : String(v[0]))}
                  max={MAX_PRICE}
                  min={10}
                  step={10}
                  data-testid="browse-price-slider"
                />
              </div>

              {/* Radius */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-brand-muted">
                    <Compass className={`w-3.5 h-3.5 ${userLocation ? "text-brand-primary" : "text-brand-muted"}`} />
                    {t("browse.filters_radius", "Distance")}
                  </span>
                  <span className="text-sm font-semibold text-brand-text" data-testid="browse-radius-value">
                    {t("browse.radius", { value: radiusUI })}
                  </span>
                </div>
                <Slider
                  value={[radiusUI]}
                  onValueChange={(v) => { setRadiusUI(v[0]); if (!userLocation && !geoLoading) requestGeo(); }}
                  onValueCommit={(v) => updateParam("radius_km", String(v[0]))}
                  max={200}
                  min={5}
                  step={5}
                  data-testid="browse-radius-slider"
                />
                {!userLocation && (
                  <Button
                    onClick={requestGeo}
                    variant="outline"
                    size="sm"
                    disabled={geoLoading}
                    data-testid="browse-use-location-btn"
                    className="mt-2 rounded-lg border-brand-border h-8 px-2 text-xs w-full"
                  >
                    {geoLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Crosshair className="w-3 h-3 mr-1.5" />}
                    {t("browse.use_my_location")}
                  </Button>
                )}
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    ["city", "state", "postal_code", "max_price", "radius_km"].forEach((k) => next.delete(k));
                    setParams(next);
                  }}
                  data-testid="browse-clear-popover-filters"
                  className="w-full text-xs font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors pt-1"
                >
                  {t("common.clear_filters")}
                </button>
              )}
            </PopoverContent>
          </Popover>

          {/* View toggle */}
          <div className="ml-auto flex gap-1 bg-brand-subtle rounded-xl p-1">
            <button onClick={() => setView("split")} data-testid="view-split"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "split" ? "bg-white text-brand-text shadow-sm" : "text-brand-muted"}`}>
              {t("browse.view_split")}
            </button>
            <button onClick={() => setView("grid")} data-testid="view-grid"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${view === "grid" ? "bg-white text-brand-text shadow-sm" : "text-brand-muted"}`}>
              <ListIcon className="w-3.5 h-3.5" /> {t("browse.view_grid")}
            </button>
            <button onClick={() => setView("map")} data-testid="view-map"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${view === "map" ? "bg-white text-brand-text shadow-sm" : "text-brand-muted"}`}>
              <MapIcon className="w-3.5 h-3.5" /> {t("browse.view_map")}
            </button>
          </div>
        </div>

        {/* Active filter pills */}
        {activeFilterChips.length > 0 && (
          <div className="max-w-[1600px] mx-auto px-6 pb-3 flex flex-wrap items-center gap-2" data-testid="browse-active-filters">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.onClear}
                data-testid={`browse-chip-${chip.key}`}
                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-subtle hover:bg-brand-primary/10 border border-brand-border text-xs font-medium text-brand-text transition-colors"
              >
                <span className="text-brand-muted">{chip.label}:</span>
                <span>{chip.value}</span>
                <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </button>
            ))}
            <button
              onClick={() => setParams(new URLSearchParams())}
              data-testid="browse-clear-all-chips"
              className="text-xs font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors ml-1"
            >
              {t("common.clear_filters")}
            </button>
          </div>
        )}
      </div>

      <div className="max-w-[1600px] mx-auto">
        {loading && view === "grid" ? (
          <div className="p-16 text-center text-brand-muted" data-testid="browse-loading">{t("common.loading")}</div>
        ) : view === "grid" ? (
          tools.length === 0 ? (
            <div className="p-16 text-center" data-testid="browse-empty">
              <div className="font-heading text-2xl font-bold mb-2">{t("browse.no_tools_found")}</div>
              <p className="text-brand-muted mb-6">{t("browse.no_tools_subtitle")}</p>
              <Button onClick={() => setParams(new URLSearchParams())}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">
                {t("common.clear_filters")}
              </Button>
            </div>
          ) : (
            <div className="px-6 py-8">
              <div className="mb-4 text-sm text-brand-muted">
                {tools.length === 1
                  ? t("browse.tools_available_one", { count: tools.length })
                  : t("browse.tools_available_other", { count: tools.length })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {tools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
              </div>
            </div>
          )
        ) : view === "map" ? (
          <div className="h-[calc(100vh-160px)] p-4 relative">
            <MapView
              tools={tools}
              center={mapCenter}
              onSelect={(tool: Tool) => nav(`/tools/${tool.id}`)}
              selectedId={selectedId}
              onCenterChange={handleMapMove}
            />
            <MapSearchHint searchCenter={searchCenter} onRecenter={recenterToMyLocation} userLocationAvailable={!!userLocation} />
            {loading && (
              <div className="absolute top-7 right-7 z-[400] bg-white/95 backdrop-blur shadow-md rounded-full border border-brand-border px-3 py-1.5 flex items-center gap-2 text-xs font-semibold" data-testid="map-loading-pill">
                <Loader2 className="w-3 h-3 animate-spin" /> {t("common.loading")}
              </div>
            )}
            {!loading && tools.length === 0 && (
              <div
                className="absolute bottom-7 left-1/2 -translate-x-1/2 z-[400] bg-white shadow-lg rounded-2xl border border-brand-border px-5 py-3 text-sm font-medium pointer-events-auto"
                data-testid="browse-empty-overlay"
              >
                {t("browse.no_tools_in_area")}
              </div>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_1.4fr] h-[calc(100vh-160px)]">
            <div className="overflow-y-auto px-6 py-6 border-r border-brand-border">
              {loading ? (
                <div className="p-8 text-center text-brand-muted">{t("common.loading")}</div>
              ) : tools.length === 0 ? (
                <div className="p-8 text-center" data-testid="browse-empty-list">
                  <div className="font-heading text-lg font-bold mb-1">{t("browse.no_tools_in_area")}</div>
                  <p className="text-sm text-brand-muted mb-4">{t("browse.no_tools_in_area_hint")}</p>
                  <Button
                    onClick={recenterToMyLocation}
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    data-testid="browse-empty-recenter-btn"
                  >
                    {t("browse.use_my_location")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-4 text-sm text-brand-muted">
                    {tools.length === 1
                      ? t("browse.tools_available_one", { count: tools.length })
                      : t("browse.tools_available_other", { count: tools.length })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {tools.map((tool) => (
                      <div
                        key={tool.id}
                        onMouseEnter={() => setSelectedId(tool.id)}
                        onMouseLeave={() => setSelectedId(null)}
                      >
                        <ToolCard tool={tool} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="hidden lg:block p-4 relative">
              <MapView
                tools={tools}
                center={mapCenter}
                onSelect={(tool: Tool) => setSelectedId(tool.id)}
                selectedId={selectedId}
                onCenterChange={handleMapMove}
              />
              <MapSearchHint searchCenter={searchCenter} onRecenter={recenterToMyLocation} userLocationAvailable={!!userLocation} />
              {loading && (
                <div className="absolute top-7 right-7 z-[400] bg-white/95 backdrop-blur shadow-md rounded-full border border-brand-border px-3 py-1.5 flex items-center gap-2 text-xs font-semibold">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t("common.loading")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
