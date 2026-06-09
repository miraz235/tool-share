import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api, imageUrl } from "@/lib/api";
import Header from "@/components/Header";
import ToolCard from "@/components/ToolCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Calendar, Heart, Package, Trash2, ShieldCheck, ShieldAlert, Bell, BellOff, Users, X } from "lucide-react";
import { formatDateRange } from "@/lib/dateFormat";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const [myTools, setMyTools] = useState([]);
  const [renterBookings, setRenterBookings] = useState([]);
  const [ownerBookings, setOwnerBookings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [follows, setFollows] = useState([]);

  useEffect(() => {
    if (!loading && !user) nav("/login");
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    api.get("/my/tools").then(r => setMyTools(r.data));
    api.get("/bookings", { params: { role: "renter" } }).then(r => setRenterBookings(r.data));
    api.get("/bookings", { params: { role: "owner" } }).then(r => setOwnerBookings(r.data));
    api.get("/favorites").then(r => setFavorites(r.data));
    api.get("/follows").then(r => setFollows(r.data));
  }, [user]);

  if (!user) return null;

  const startVerification = async () => {
    try {
      const r = await api.post("/identity/verify/start", { return_url: window.location.origin + "/dashboard" });
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't start verification");
    }
  };

  const deleteTool = async (id) => {
    if (!window.confirm("Delete this listing?")) return;
    try {
      await api.delete(`/tools/${id}`);
      setMyTools(myTools.filter(t => t.id !== id));
      toast.success("Listing deleted");
    } catch { toast.error("Failed"); }
  };

  const updateBookingStatus = async (id, status) => {
    try {
      await api.put(`/bookings/${id}/status`, { status });
      const r = await api.get("/bookings", { params: { role: "owner" } });
      setOwnerBookings(r.data);
      toast.success(`Booking ${status}`);
    } catch { toast.error("Failed"); }
  };

  const toggleAlert = async (toolId, current) => {
    try {
      const next = !current;
      await api.post(`/favorites/${toolId}`, null, { params: { alerts: next } });
      setFavorites(favs => favs.map(f => f.id === toolId ? { ...f, alerts_on: next } : f));
      toast.success(next ? t("dashboard.alerts_enabled") : t("dashboard.alerts_disabled"));
    } catch { toast.error("Failed"); }
  };

  const removeFavorite = async (toolId) => {
    try {
      await api.delete(`/favorites/${toolId}`);
      setFavorites(favs => favs.filter(f => f.id !== toolId));
    } catch { toast.error("Failed"); }
  };

  const unfollowOwner = async (ownerId) => {
    try {
      await api.delete(`/follows/${ownerId}`);
      setFollows(fs => fs.filter(o => o.id !== ownerId));
      toast.success(t("profile.unfollowed"));
    } catch { toast.error("Failed"); }
  };

  const statusColor = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-700",
    completed: "bg-blue-100 text-blue-700",
  };

  const initials = user.name?.split(" ").map(n => n[0]).slice(0,2).join("");

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12">
        {/* Hero */}
        <div className="flex items-center gap-6 mb-10 bg-white border border-brand-border rounded-2xl p-6">
          <Avatar className="h-20 w-20">
            {user.picture && <AvatarImage src={user.picture} />}
            <AvatarFallback className="bg-brand-primary text-white font-heading font-bold text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="font-heading text-3xl font-extrabold">{t("dashboard.welcome", { name: user.name.split(" ")[0] })}</h1>
            <p className="text-brand-muted">{user.email}</p>
            <div className="flex gap-4 mt-3 text-sm">
              <div><span className="font-bold">{myTools.length}</span> <span className="text-brand-muted">{t("dashboard.listings_count")}</span></div>
              <div><span className="font-bold">{renterBookings.length}</span> <span className="text-brand-muted">{t("dashboard.rentals_count")}</span></div>
              <div><span className="font-bold">{favorites.length}</span> <span className="text-brand-muted">{t("dashboard.saved_count")}</span></div>
            </div>
          </div>
          <Button asChild className="bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold" data-testid="dashboard-list-btn">
            <Link to="/list"><Plus className="w-4 h-4 mr-1" /> {t("dashboard.list_tool")}</Link>
          </Button>
        </div>

        {/* Identity verification banner */}
        {!user.is_verified && (
          <div className="bg-brand-secondary/10 border border-brand-secondary/30 rounded-2xl p-5 mb-6 flex items-center gap-4" data-testid="verify-banner">
            <div className="w-12 h-12 rounded-xl bg-brand-secondary/15 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-brand-secondary" />
            </div>
            <div className="flex-1">
              <div className="font-heading font-bold text-brand-text">{t("dashboard.verify_title")}</div>
              <p className="text-sm text-brand-muted">{t("dashboard.verify_subtitle")}</p>
            </div>
            <Button onClick={startVerification} data-testid="start-verification-btn"
              className="bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold">
              <ShieldCheck className="w-4 h-4 mr-1.5" /> {t("dashboard.verify_btn")}
            </Button>
          </div>
        )}

        <Tabs defaultValue="listings" className="w-full">
          <TabsList className="bg-white border border-brand-border rounded-xl p-1 mb-6">
            <TabsTrigger value="listings" data-testid="tab-listings" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-1.5" /> {t("dashboard.tab_listings")}
            </TabsTrigger>
            <TabsTrigger value="renter" data-testid="tab-renter" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-1.5" /> {t("dashboard.tab_renter")}
            </TabsTrigger>
            <TabsTrigger value="owner" data-testid="tab-owner" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              {t("dashboard.tab_owner")}
            </TabsTrigger>
            <TabsTrigger value="favorites" data-testid="tab-favorites" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Heart className="w-4 h-4 mr-1.5" /> {t("dashboard.tab_favorites")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listings">
            {myTools.length === 0 ? (
              <EmptyState icon={Package} title={t("dashboard.empty_listings")} cta={t("dashboard.list_first")} to="/list" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTools.map(t => (
                  <div key={t.id} className="relative">
                    <ToolCard tool={t} />
                    <Button variant="outline" size="sm" onClick={() => deleteTool(t.id)}
                      data-testid={`delete-tool-${t.id}`}
                      className="absolute top-3 left-3 z-10 rounded-lg bg-white border-brand-border">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="renter">
            {renterBookings.length === 0 ? (
              <EmptyState icon={Calendar} title={t("dashboard.empty_renter")} cta={t("dashboard.browse_tools")} to="/browse" />
            ) : (
              <div className="space-y-3">
                {renterBookings.map(b => <BookingRow key={b.id} booking={b} role="renter" />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="owner">
            {ownerBookings.length === 0 ? (
              <EmptyState icon={Package} title={t("dashboard.empty_owner")} cta={t("dashboard.list_tool")} to="/list" />
            ) : (
              <div className="space-y-3">
                {ownerBookings.map(b => (
                  <BookingRow key={b.id} booking={b} role="owner" onUpdateStatus={updateBookingStatus} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites">
            <div className="space-y-10">
              {/* Saved Tools */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-lg font-bold flex items-center gap-2">
                    <Heart className="w-5 h-5 text-brand-secondary" />
                    {t("dashboard.saved_tools")} <span className="text-brand-muted font-medium">({favorites.length})</span>
                  </h3>
                </div>
                {favorites.length === 0 ? (
                  <EmptyState icon={Heart} title={t("dashboard.empty_favorites")} cta={t("dashboard.discover_tools")} to="/browse" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favorites.map(tool => (
                      <div key={tool.id} className="relative group">
                        <ToolCard tool={tool} />
                        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
                          <button
                            onClick={() => toggleAlert(tool.id, tool.alerts_on)}
                            title={tool.alerts_on ? t("dashboard.alerts_on") : t("dashboard.alerts_off")}
                            data-testid={`fav-alert-${tool.id}`}
                            className={`w-9 h-9 rounded-full backdrop-blur flex items-center justify-center shadow-sm transition-colors ${tool.alerts_on
                              ? "bg-brand-secondary text-white hover:bg-brand-secondary-hover"
                              : "bg-white/95 text-brand-muted hover:text-brand-secondary hover:bg-white"}`}
                          >
                            {tool.alerts_on ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => removeFavorite(tool.id)}
                            title={t("dashboard.remove_favorite")}
                            data-testid={`fav-remove-${tool.id}`}
                            className="w-9 h-9 rounded-full bg-white/95 text-brand-muted hover:text-red-500 hover:bg-white backdrop-blur flex items-center justify-center shadow-sm transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Followed Owners */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-primary" />
                    {t("dashboard.followed_owners")} <span className="text-brand-muted font-medium">({follows.length})</span>
                  </h3>
                </div>
                {follows.length === 0 ? (
                  <div className="bg-white border border-brand-border rounded-2xl p-10 text-center">
                    <Users className="w-10 h-10 mx-auto text-brand-muted/40 mb-3" />
                    <p className="text-sm text-brand-muted">{t("dashboard.empty_follows")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {follows.map(o => (
                      <div key={o.id} className="bg-white border border-brand-border rounded-2xl p-5 flex items-center gap-4" data-testid={`follow-row-${o.id}`}>
                        <Avatar className="h-14 w-14">
                          {o.picture && <AvatarImage src={o.picture} />}
                          <AvatarFallback className="bg-brand-primary text-white font-bold">{o.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link to={`/profile/${o.id}`} className="font-heading font-bold hover:underline block truncate">{o.name}</Link>
                          <div className="text-xs text-brand-muted">{o.tool_count} {t("dashboard.tools_listed")}</div>
                        </div>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => unfollowOwner(o.id)}
                          data-testid={`unfollow-${o.id}`}
                          className="rounded-xl text-xs"
                        >
                          {t("profile.unfollow")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, cta, to }) {
  return (
    <div className="bg-white border border-brand-border rounded-2xl p-16 text-center">
      <Icon className="w-12 h-12 mx-auto text-brand-muted/40 mb-4" />
      <h3 className="font-heading text-xl font-bold mb-1">{title}</h3>
      <Button asChild className="mt-4 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}

function BookingRow({ booking, role, onUpdateStatus }: { booking: any; role: string; onUpdateStatus?: (id: string, status: string) => void }) {
  const { t, i18n } = useTranslation();
  const statusColor = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-700",
    completed: "bg-blue-100 text-blue-700",
  };
  return (
    <div className="bg-white border border-brand-border rounded-2xl p-5 flex items-center gap-4" data-testid={`booking-row-${booking.id}`}>
      <div className="w-20 h-20 bg-brand-subtle rounded-xl overflow-hidden shrink-0">
        {booking.tool?.images?.[0] && <img src={imageUrl(booking.tool.images[0])} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link to={`/tools/${booking.tool_id}`} className="font-heading font-bold hover:underline">{booking.tool?.title}</Link>
          <Badge className={`${statusColor[booking.status]} border-0 capitalize`}>{booking.status}</Badge>
        </div>
        <div className="text-sm text-brand-muted">
          {formatDateRange(booking.start_date, booking.end_date, i18n.language)} · ${booking.total_price} ·
          {role === "renter" ? ` ${t("common.from")} ${booking.counterparty?.name}` : ` ${t("common.for")} ${booking.counterparty?.name}`}
        </div>
      </div>
      {role === "owner" && booking.status === "pending" && (
        <div className="flex gap-2">
          <Button onClick={() => onUpdateStatus(booking.id, "approved")}
            data-testid={`approve-${booking.id}`}
            className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">{t("common.approve")}</Button>
          <Button onClick={() => onUpdateStatus(booking.id, "declined")} variant="outline"
            data-testid={`decline-${booking.id}`}
            className="rounded-xl">{t("common.decline")}</Button>
        </div>
      )}
      <Button asChild variant="ghost" className="rounded-xl" data-testid={`view-booking-${booking.id}`}>
        <Link to={`/bookings/${booking.id}`}>{t("common.view")}</Link>
      </Button>
    </div>
  );
}
