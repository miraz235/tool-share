import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { api, imageUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/dateFormat";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Eye, EyeOff, Loader2, RefreshCcw, TrendingUp, AlertTriangle } from "lucide-react";

type DayCell = {
  date: string;
  booked: number;
  remaining: number;
  owner_blocked: boolean;
};

type ToolRow = {
  id: string;
  title: string;
  image: string | null;
  quantity_total: number;
  is_available: boolean;
  daily_price: number;
  price_currency: string;
  days: DayCell[];
};

type InventoryResponse = {
  days: string[];
  tools: ToolRow[];
};

const HORIZON_DAYS = 21;
const DAY_WIDTH = 36; // px

export default function Inventory() {
  const { t, i18n } = useTranslation();
  const { user, loading } = useAuth() as any;
  const { format } = useCurrency() as any;
  const nav = useNavigate();
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) nav("/login");
  }, [loading, user, nav]);

  const fetchInventory = () => {
    setLoadingData(true);
    api.get(`/my/inventory?days=${HORIZON_DAYS}`)
      .then((r) => setData(r.data))
      .catch(() => toast.error(t("inventory.load_failed", "Couldn't load inventory")))
      .finally(() => setLoadingData(false));
  };

  useEffect(() => { if (user) fetchInventory(); }, [user]);

  const toggleStockOut = async (toolId: string, date: string) => {
    const key = `${toolId}__${date}`;
    if (pendingCells.has(key)) return;
    setPendingCells((s) => new Set([...s, key]));
    try {
      await api.post(`/tools/${toolId}/block_dates`, [date]);
      // Optimistic re-fetch — cheap since horizon is small
      fetchInventory();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("inventory.toggle_failed", "Toggle failed"));
    } finally {
      setPendingCells((s) => {
        const n = new Set(s); n.delete(key); return n;
      });
    }
  };

  const toggleAvailability = async (toolId: string, next: boolean) => {
    try {
      await api.put(`/tools/${toolId}/availability?is_available=${next}`);
      toast.success(next ? t("inventory.shown_toast", "Listing visible") : t("inventory.hidden_toast", "Listing hidden"));
      fetchInventory();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  // Summary metrics across the horizon — surfaced above the heatmap.
  const stats = useMemo(() => {
    if (!data) return { soldOutDays: 0, hotDays: 0, totalUnitsBooked: 0, utilisation: 0 };
    let soldOutDays = 0;
    let hotDays = 0;
    let totalBooked = 0;
    let totalCapacity = 0;
    data.tools.forEach((t) => {
      t.days.forEach((d) => {
        totalCapacity += t.quantity_total;
        totalBooked += d.booked;
        if (d.remaining === 0) soldOutDays += 1;
        else if (d.remaining <= Math.ceil(t.quantity_total * 0.3) && d.booked > 0) hotDays += 1;
      });
    });
    return {
      soldOutDays,
      hotDays,
      totalUnitsBooked: totalBooked,
      utilisation: totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0,
    };
  }, [data]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-[1500px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <Link to="/dashboard" className="inline-flex items-center text-sm font-medium text-brand-muted hover:text-brand-text transition-colors mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> {t("inventory.back_to_dashboard", "Back to dashboard")}
            </Link>
            <h1 className="font-heading text-4xl font-extrabold text-brand-text">
              {t("inventory.title", "Inventory dashboard")}
            </h1>
            <p className="text-sm text-brand-muted mt-1">
              {t("inventory.subtitle", "Next {{days}} days · click any cell to toggle stock-out", { days: HORIZON_DAYS })}
            </p>
          </div>
          <Button
            onClick={fetchInventory}
            variant="outline"
            size="sm"
            data-testid="inventory-refresh-btn"
            className="rounded-xl border-brand-border"
          >
            <RefreshCcw className="w-4 h-4 mr-1.5" /> {t("common.refresh", "Refresh")}
          </Button>
        </div>

        {/* KPI strip */}
        {data && data.tools.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="inventory-kpi-strip">
            <Kpi
              icon={<TrendingUp className="w-4 h-4" />}
              label={t("inventory.kpi_utilisation", "Utilisation")}
              value={`${stats.utilisation}%`}
              testid="inventory-kpi-utilisation"
            />
            <Kpi
              icon={<Calendar className="w-4 h-4" />}
              label={t("inventory.kpi_units_booked", "Units booked")}
              value={String(stats.totalUnitsBooked)}
              testid="inventory-kpi-units"
            />
            <Kpi
              icon={<AlertTriangle className="w-4 h-4" />}
              label={t("inventory.kpi_hot_days", "Low-stock days")}
              value={String(stats.hotDays)}
              accent
              testid="inventory-kpi-hot"
            />
            <Kpi
              icon={<EyeOff className="w-4 h-4" />}
              label={t("inventory.kpi_sold_out_days", "Sold-out days")}
              value={String(stats.soldOutDays)}
              accent
              testid="inventory-kpi-soldout"
            />
          </div>
        )}

        {loadingData && !data && (
          <div className="py-20 flex items-center justify-center text-brand-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("common.loading", "Loading…")}
          </div>
        )}

        {data && data.tools.length === 0 && (
          <div className="bg-white rounded-2xl border border-brand-border p-12 text-center" data-testid="inventory-empty">
            <Calendar className="w-12 h-12 text-brand-muted mx-auto mb-3" />
            <div className="font-heading font-bold text-brand-text mb-1">
              {t("inventory.empty_title", "Nothing listed yet")}
            </div>
            <p className="text-sm text-brand-muted mb-4">
              {t("inventory.empty_body", "List your first tool to see its availability heatmap here.")}
            </p>
            <Link to="/list">
              <Button className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-semibold">
                {t("inventory.empty_cta", "List a tool")}
              </Button>
            </Link>
          </div>
        )}

        {/* Heatmap */}
        {data && data.tools.length > 0 && (
          <div className="bg-white rounded-2xl border border-brand-border overflow-hidden" data-testid="inventory-heatmap">
            <Legend t={t} />
            <HeatmapTable
              data={data}
              i18nLang={i18n.language}
              pendingCells={pendingCells}
              onToggleCell={toggleStockOut}
              onToggleAvailability={toggleAvailability}
              format={format}
            />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ---- subcomponents ---------------------------------------------------------

function Kpi({
  icon, label, value, accent, testid,
}: { icon: React.ReactNode; label: string; value: string; accent?: boolean; testid: string }) {
  return (
    <div
      className={`rounded-xl border p-4 ${accent ? "bg-brand-secondary/5 border-brand-secondary/30" : "bg-white border-brand-border"}`}
      data-testid={testid}
    >
      <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold ${accent ? "text-brand-secondary" : "text-brand-muted"}`}>
        {icon}{label}
      </div>
      <div className="font-heading text-3xl font-extrabold text-brand-text mt-1">{value}</div>
    </div>
  );
}

function Legend({ t }: { t: any }) {
  return (
    <div className="border-b border-brand-border px-4 py-3 flex items-center flex-wrap gap-3 text-[11px]" data-testid="inventory-legend">
      <span className="text-brand-muted uppercase tracking-wider font-bold">{t("inventory.legend", "Stock")}:</span>
      <LegendDot color="bg-brand-subtle" border="border border-brand-border" label={t("inventory.legend_full", "Full")} />
      <LegendDot color="bg-brand-secondary/30" label={t("inventory.legend_low", "Low")} />
      <LegendDot color="bg-brand-secondary/70" label={t("inventory.legend_critical", "Critical")} />
      <LegendDot color="bg-red-500" label={t("inventory.legend_sold_out", "Sold out")} />
      <LegendDot color="bg-slate-700" label={t("inventory.legend_blocked", "Blocked by you")} />
    </div>
  );
}

function LegendDot({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-brand-text">
      <span className={`inline-block w-3.5 h-3.5 rounded ${color} ${border || ""}`} /> {label}
    </span>
  );
}

function HeatmapTable({
  data, i18nLang, pendingCells, onToggleCell, onToggleAvailability, format,
}: {
  data: InventoryResponse;
  i18nLang: string;
  pendingCells: Set<string>;
  onToggleCell: (toolId: string, date: string) => void;
  onToggleAvailability: (toolId: string, next: boolean) => void;
  format: (n: number, opts?: any) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto" data-testid="inventory-heatmap-scroll">
      <table className="w-full text-sm">
        <thead className="bg-brand-subtle/60 sticky top-0">
          <tr>
            <th className="text-left p-3 font-bold text-brand-muted text-[11px] uppercase tracking-wider min-w-[240px] sticky left-0 bg-brand-subtle/95 backdrop-blur z-10">
              {t("inventory.col_tool", "Tool")}
            </th>
            {data.days.map((d) => {
              const date = new Date(d + "T00:00:00");
              const dow = date.toLocaleDateString(i18nLang, { weekday: "short" });
              const dom = date.getDate();
              const isWeekend = [0, 6].includes(date.getDay());
              return (
                <th
                  key={d}
                  className={`p-1.5 text-center font-bold text-brand-muted text-[10px] uppercase tracking-wider`}
                  style={{ minWidth: DAY_WIDTH }}
                >
                  <div className={isWeekend ? "text-brand-secondary" : ""}>{dow}</div>
                  <div className="text-brand-text text-xs font-extrabold">{dom}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.tools.map((tool) => (
            <tr key={tool.id} className="border-t border-brand-border" data-testid={`inventory-row-${tool.id}`}>
              <td className="p-3 sticky left-0 bg-white z-[1]">
                <div className="flex items-center gap-3">
                  {tool.image && (
                    <img src={imageUrl(tool.image)} alt="" className="w-10 h-10 rounded-lg object-cover border border-brand-border shrink-0" />
                  )}
                  <div className="min-w-0">
                    <Link to={`/tools/${tool.id}`} className="font-heading font-bold text-brand-text hover:text-brand-primary transition-colors truncate block">
                      {tool.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-brand-border">
                        {t("inventory.units", { count: tool.quantity_total, defaultValue_one: "{{count}} unit", defaultValue_other: "{{count}} units" })}
                      </Badge>
                      <button
                        onClick={() => onToggleAvailability(tool.id, !tool.is_available)}
                        data-testid={`inventory-toggle-availability-${tool.id}`}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${tool.is_available ? "text-brand-primary hover:text-brand-primary-hover" : "text-brand-muted hover:text-brand-text"}`}
                      >
                        {tool.is_available
                          ? <><Eye className="w-3 h-3" /> {t("inventory.shown", "Live")}</>
                          : <><EyeOff className="w-3 h-3" /> {t("inventory.hidden", "Hidden")}</>}
                      </button>
                    </div>
                  </div>
                </div>
              </td>
              {tool.days.map((cell) => (
                <HeatCell
                  key={cell.date}
                  cell={cell}
                  capacity={tool.quantity_total}
                  pending={pendingCells.has(`${tool.id}__${cell.date}`)}
                  onClick={() => onToggleCell(tool.id, cell.date)}
                  testid={`inventory-cell-${tool.id}-${cell.date}`}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatCell({
  cell, capacity, pending, onClick, testid,
}: {
  cell: DayCell;
  capacity: number;
  pending: boolean;
  onClick: () => void;
  testid: string;
}) {
  const { t } = useTranslation();
  let cls = "bg-brand-subtle border border-brand-border text-brand-muted";
  let label = String(cell.remaining);
  if (cell.owner_blocked) {
    cls = "bg-slate-700 text-white border-slate-800";
    label = "✕";
  } else if (cell.remaining === 0) {
    cls = "bg-red-500 text-white border-red-600 font-bold";
    label = "0";
  } else if (capacity > 1) {
    const pct = cell.remaining / capacity;
    if (pct <= 0.3) cls = "bg-brand-secondary/70 text-white border-brand-secondary";
    else if (pct < 1) cls = "bg-brand-secondary/30 text-brand-secondary-hover border-brand-secondary/50";
  }
  const dateLabel = formatDate(cell.date);
  const tooltip = cell.owner_blocked
    ? t("inventory.cell_blocked", "Blocked by you — click to unblock")
    : cell.remaining === 0
      ? t("inventory.cell_soldout", "Sold out by bookings")
      : t("inventory.cell_remaining", "{{remaining}} of {{capacity}} left — click to mark stock-out", { remaining: cell.remaining, capacity });

  return (
    <td className="p-1 align-middle">
      <button
        type="button"
        onClick={onClick}
        title={`${dateLabel} — ${tooltip}`}
        data-testid={testid}
        data-remaining={cell.remaining}
        data-blocked={cell.owner_blocked ? "1" : "0"}
        disabled={pending}
        className={`w-9 h-9 rounded-md text-[11px] font-mono transition-all hover:ring-2 ring-brand-primary/40 ring-offset-1 ring-offset-white disabled:opacity-50 disabled:cursor-wait ${cls}`}
      >
        {pending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : label}
      </button>
    </td>
  );
}
