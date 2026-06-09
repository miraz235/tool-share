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
import { Map as MapIcon, List as ListIcon, Search, SlidersHorizontal } from "lucide-react";

export default function Browse() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [tools, setTools] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("split"); // split | grid | map
  const [selectedId, setSelectedId] = useState(null);

  const q = params.get("q") || "";
  const category = params.get("category") || "all";
  const city = params.get("city") || "";
  const maxPrice = parseInt(params.get("max_price") || "500", 10);

  useEffect(() => {
    api.get("/categories").then(r => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const queryParams = {};
    if (q) queryParams.q = q;
    if (category && category !== "all") queryParams.category = category;
    if (city) queryParams.city = city;
    if (maxPrice && maxPrice < 500) queryParams.max_price = maxPrice;
    api.get("/tools", { params: queryParams })
      .then(r => setTools(r.data))
      .finally(() => setLoading(false));
  }, [q, category, city, maxPrice]);

  const updateParam = (k, v) => {
    const p = new URLSearchParams(params);
    if (v && v !== "all") p.set(k, v); else p.delete(k);
    setParams(p);
  };

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
              onKeyDown={(e) => { if (e.key === 'Enter') updateParam("q", e.currentTarget.value); }}
              className="border-0 bg-transparent focus-visible:ring-0 px-0 h-10"
            />
          </div>

          <Select value={category} onValueChange={(v) => updateParam("category", v)}>
            <SelectTrigger className="w-44 rounded-xl" data-testid="browse-category-select">
              <SelectValue placeholder={t("common.all_categories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all_categories")}</SelectItem>
              {categories.map(c => <SelectItem key={c.slug} value={c.slug}>{t(`categories.${c.slug}`, c.name)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input
            data-testid="browse-city-input"
            placeholder={t("common.city")}
            defaultValue={city}
            onKeyDown={(e) => { if (e.key === 'Enter') updateParam("city", e.currentTarget.value); }}
            className="w-36 rounded-xl"
          />

          <div className="flex items-center gap-2 px-2">
            <SlidersHorizontal className="w-4 h-4 text-brand-muted" />
            <span className="text-sm font-medium">{t("browse.max_price", { value: maxPrice })}</span>
            <Slider
              value={[maxPrice]}
              onValueCommit={(v) => updateParam("max_price", String(v[0]))}
              max={500} min={10} step={10}
              className="w-40"
              data-testid="browse-price-slider"
            />
          </div>

          <div className="ml-auto flex gap-1 bg-brand-subtle rounded-xl p-1">
            <button onClick={() => setView("split")} data-testid="view-split"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'split' ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted'}`}>
              {t("browse.view_split")}
            </button>
            <button onClick={() => setView("grid")} data-testid="view-grid"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${view === 'grid' ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted'}`}>
              <ListIcon className="w-3.5 h-3.5" /> {t("browse.view_grid")}
            </button>
            <button onClick={() => setView("map")} data-testid="view-map"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${view === 'map' ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted'}`}>
              <MapIcon className="w-3.5 h-3.5" /> {t("browse.view_map")}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto">
        {loading ? (
          <div className="p-16 text-center text-brand-muted" data-testid="browse-loading">{t("common.loading")}</div>
        ) : tools.length === 0 ? (
          <div className="p-16 text-center" data-testid="browse-empty">
            <div className="font-heading text-2xl font-bold mb-2">{t("browse.no_tools_found")}</div>
            <p className="text-brand-muted mb-6">{t("browse.no_tools_subtitle")}</p>
            <Button onClick={() => setParams(new URLSearchParams())}
              className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">
              {t("common.clear_filters")}
            </Button>
          </div>
        ) : view === "grid" ? (
          <div className="px-6 py-8">
            <div className="mb-4 text-sm text-brand-muted">{tools.length === 1 ? t("browse.tools_available_one", { count: tools.length }) : t("browse.tools_available_other", { count: tools.length })}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {tools.map(t => <ToolCard key={t.id} tool={t} />)}
            </div>
          </div>
        ) : view === "map" ? (
          <div className="h-[calc(100vh-160px)] p-4">
            <MapView tools={tools} onSelect={(t) => nav(`/tools/${t.id}`)} selectedId={selectedId} />
          </div>
        ) : (
          // SPLIT view
          <div className="grid lg:grid-cols-[1fr_1.4fr] h-[calc(100vh-160px)]">
            <div className="overflow-y-auto px-6 py-6 border-r border-brand-border">
              <div className="mb-4 text-sm text-brand-muted">{tools.length === 1 ? t("browse.tools_available_one", { count: tools.length }) : t("browse.tools_available_other", { count: tools.length })}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {tools.map(t => (
                  <div key={t.id} onMouseEnter={() => setSelectedId(t.id)} onMouseLeave={() => setSelectedId(null)}>
                    <ToolCard tool={t} />
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:block p-4">
              <MapView tools={tools} onSelect={(t) => setSelectedId(t.id)} selectedId={selectedId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
