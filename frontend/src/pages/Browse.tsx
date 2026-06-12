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
import { Map as MapIcon, List as ListIcon, Search, SlidersHorizontal, Compass, Loader2, Crosshair } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* Filter bar */}
      <div className="border-b border-brand-border bg-white sticky top-16 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm bg-brand-subtle rounded-xl px-3">
            <Search className="w-4 h-4 text-brand-muted" />
            <Input
              data-testid="browse-search-input"
              placeholder={`${t("common.search")}...`}
              defaultValue={q}
              onKeyDown={(e) => { if (e.key === "Enter") updateParam("q", e.currentTarget.value); }}
              className="border-0 bg-transparent focus-visible:ring-0 px-0 h-10"
            />
          </div>

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

          <Input
            data-testid="browse-city-input"
            placeholder={t("common.city")}
            defaultValue={city}
            onKeyDown={(e) => { if (e.key === "Enter") updateParam("city", e.currentTarget.value); }}
            className="w-32 rounded-xl"
          />
          <Input
            data-testid="browse-state-input"
            placeholder={t("common.state", "State / Province")}
            defaultValue={stateFilter}
            onKeyDown={(e) => { if (e.key === "Enter") updateParam("state", e.currentTarget.value); }}
            className="w-32 rounded-xl"
          />
          <Input
            data-testid="browse-postal-input"
            placeholder={t("common.postal_code", "ZIP / Postal")}
            defaultValue={postal}
            onKeyDown={(e) => { if (e.key === "Enter") updateParam("postal_code", e.currentTarget.value); }}
            className="w-32 rounded-xl"
          />

          {/* Max price slider */}
          <div className="flex items-center gap-2 px-2">
            <SlidersHorizontal className="w-4 h-4 text-brand-muted" />
            <span className="text-sm font-medium whitespace-nowrap min-w-[110px]">
              {t("browse.max_price", { value: maxPriceUI })}
            </span>
            <Slider
              value={[maxPriceUI]}
              onValueChange={(v) => setMaxPriceUI(v[0])}
              onValueCommit={(v) => updateParam("max_price", v[0] >= MAX_PRICE ? "" : String(v[0]))}
              max={MAX_PRICE}
              min={10}
              step={10}
              className="w-32"
              data-testid="browse-price-slider"
            />
          </div>

          {/* Radius slider */}
          <div
            className="flex items-center gap-2 px-2 border-l border-brand-border pl-3"
            onMouseEnter={() => { if (!userLocation && !geoLoading) requestGeo(); }}
            data-testid="browse-radius-wrap"
          >
            <Compass className={`w-4 h-4 ${userLocation ? "text-brand-primary" : "text-brand-muted"}`} />
            <span
              className="text-sm font-medium whitespace-nowrap min-w-[80px]"
              title={!userLocation ? t("browse.radius_hint") : ""}
            >
              {t("browse.radius", { value: radiusUI })}
            </span>
            <Slider
              value={[radiusUI]}
              onValueChange={(v) => { setRadiusUI(v[0]); if (!userLocation && !geoLoading) requestGeo(); }}
              onValueCommit={(v) => updateParam("radius_km", String(v[0]))}
              max={200}
              min={5}
              step={5}
              className="w-32"
              data-testid="browse-radius-slider"
            />
            {!userLocation && (
              <Button
                onClick={requestGeo}
                variant="outline"
                size="sm"
                disabled={geoLoading}
                data-testid="browse-use-location-btn"
                className="rounded-lg border-brand-border h-8 px-2 text-xs"
              >
                {geoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : t("browse.use_my_location")}
              </Button>
            )}
          </div>

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
