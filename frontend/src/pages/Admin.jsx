import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Header from "@/components/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Package, Calendar, DollarSign, AlertCircle, ShieldCheck, Search, Mail, Star, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatDateRange, formatDate, formatDateTime } from "@/lib/dateFormat";

export default function Admin() {
  const { user, loading } = useAuth();
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tools, setTools] = useState([]);
  const [emails, setEmails] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) nav("/");
  }, [loading, user, nav]);

  const refresh = () => {
    api.get("/admin/stats").then(r => setStats(r.data));
    api.get("/admin/users", { params: search ? { q: search } : {} }).then(r => setUsers(r.data));
    api.get("/admin/bookings").then(r => setBookings(r.data));
    api.get("/admin/tools").then(r => setTools(r.data));
    api.get("/admin/email_log").then(r => setEmails(r.data));
    api.get("/admin/reviews").then(r => setReviews(r.data)).catch(() => {});
  };

  useEffect(() => { if (user?.is_admin) refresh(); }, [user]);

  const toggle = async (uid, field, value) => {
    try {
      await api.put(`/admin/users/${uid}`, { [field]: value });
      setUsers(users.map(u => u.id === uid ? { ...u, [field]: value } : u));
      toast.success(t("admin.updated"));
    } catch { toast.error("Failed"); }
  };

  const toggleDispute = async (bid) => {
    try {
      const r = await api.put(`/admin/bookings/${bid}/dispute`);
      setBookings(bookings.map(b => b.id === bid ? { ...b, dispute_open: r.data.dispute_open } : b));
    } catch { toast.error("Failed"); }
  };

  const toggleHideReview = async (rid) => {
    try {
      const r = await api.put(`/admin/reviews/${rid}/hide`);
      setReviews(reviews.map(rv => rv.id === rid ? { ...rv, hidden: r.data.hidden } : rv));
      toast.success(t("admin.updated"));
    } catch { toast.error("Failed"); }
  };

  if (!user?.is_admin) return null;

  const statusColor = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-700",
    completed: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-brand-muted font-bold mb-1">{t("admin.label")}</div>
            <h1 className="font-heading text-4xl font-extrabold">{t("admin.title")}</h1>
          </div>
          <Badge className="bg-brand-primary/10 text-brand-primary border-0">
            <ShieldCheck className="w-3 h-3 mr-1" /> {t("admin.administrator")}
          </Badge>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Users} label={t("admin.users")} value={stats.users} sub={t("admin.verified", { count: stats.verified_users })} />
            <StatCard icon={Package} label={t("admin.listings")} value={stats.tools} />
            <StatCard icon={Calendar} label={t("admin.bookings")} value={stats.bookings_total} sub={t("admin.approved", { count: stats.approved_bookings })} />
            <StatCard icon={DollarSign} label={t("admin.revenue")} value={`$${stats.revenue}`} sub={t("admin.owed", { value: stats.pending_payouts })} />
          </div>
        )}

        <Tabs defaultValue="users">
          <TabsList className="bg-white border border-brand-border rounded-xl p-1 mb-6">
            <TabsTrigger value="users" data-testid="admin-tab-users" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-1.5" /> {t("admin.tab_users")}
            </TabsTrigger>
            <TabsTrigger value="bookings" data-testid="admin-tab-bookings" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-1.5" /> {t("admin.tab_bookings")}
            </TabsTrigger>
            <TabsTrigger value="tools" data-testid="admin-tab-tools" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-1.5" /> {t("admin.tab_tools")}
            </TabsTrigger>
            <TabsTrigger value="email_log" data-testid="admin-tab-emails" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Mail className="w-4 h-4 mr-1.5" /> {t("admin.tab_emails")}
            </TabsTrigger>
            <TabsTrigger value="reviews" data-testid="admin-tab-reviews" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Star className="w-4 h-4 mr-1.5" /> {t("admin.tab_reviews")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="mb-4 flex items-center gap-2 bg-white border border-brand-border rounded-xl px-3 max-w-md">
              <Search className="w-4 h-4 text-brand-muted" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') refresh(); }}
                placeholder={t("admin.search_users")}
                data-testid="admin-search-input"
                className="border-0 focus-visible:ring-0 px-0 h-10"/>
            </div>
            <div className="bg-white border border-brand-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-subtle text-left">
                  <tr>
                    <th className="p-3 font-semibold">{t("admin.user")}</th>
                    <th className="p-3 font-semibold">{t("admin.joined")}</th>
                    <th className="p-3 font-semibold">{t("common.verified")}</th>
                    <th className="p-3 font-semibold">{t("admin.admin")}</th>
                    <th className="p-3 font-semibold">{t("admin.suspended")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t border-brand-border" data-testid={`admin-user-${u.id}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {u.picture && <AvatarImage src={u.picture} />}
                            <AvatarFallback className="text-xs bg-brand-primary text-white">{u.name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">{u.name}</div>
                            <div className="text-xs text-brand-muted">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-brand-muted">{formatDate(u.created_at, i18n.language)}</td>
                      <td className="p-3"><Switch checked={!!u.is_verified} onCheckedChange={v => toggle(u.id, "is_verified", v)} /></td>
                      <td className="p-3"><Switch checked={!!u.is_admin} onCheckedChange={v => toggle(u.id, "is_admin", v)} /></td>
                      <td className="p-3"><Switch checked={!!u.is_suspended} onCheckedChange={v => toggle(u.id, "is_suspended", v)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="bg-white border border-brand-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-subtle text-left">
                  <tr>
                    <th className="p-3 font-semibold">{t("admin.tool")}</th>
                    <th className="p-3 font-semibold">{t("admin.renter")}</th>
                    <th className="p-3 font-semibold">{t("admin.owner")}</th>
                    <th className="p-3 font-semibold">{t("admin.dates")}</th>
                    <th className="p-3 font-semibold">{t("admin.total_col")}</th>
                    <th className="p-3 font-semibold">{t("admin.status")}</th>
                    <th className="p-3 font-semibold">{t("admin.paid")}</th>
                    <th className="p-3 font-semibold">{t("admin.dispute")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} className="border-t border-brand-border" data-testid={`admin-booking-${b.id}`}>
                      <td className="p-3">
                        <Link to={`/bookings/${b.id}`} className="hover:underline font-semibold">{b.tool_title}</Link>
                      </td>
                      <td className="p-3 text-brand-muted">{b.renter_name}</td>
                      <td className="p-3 text-brand-muted">{b.owner_name}</td>
                      <td className="p-3 text-xs text-brand-muted">{formatDateRange(b.start_date, b.end_date, i18n.language)}</td>
                      <td className="p-3 font-semibold">${b.total_price}</td>
                      <td className="p-3"><Badge className={`${statusColor[b.status]} border-0 capitalize`}>{b.status}</Badge></td>
                      <td className="p-3">{b.paid ? "✅" : "—"}</td>
                      <td className="p-3">
                        <Button size="sm" variant={b.dispute_open ? "destructive" : "outline"}
                          onClick={() => toggleDispute(b.id)}
                          data-testid={`dispute-toggle-${b.id}`}
                          className="rounded-lg">
                          <AlertCircle className="w-3 h-3 mr-1" /> {b.dispute_open ? "Open" : "—"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="bg-white border border-brand-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-subtle text-left">
                  <tr>
                    <th className="p-3 font-semibold">{t("admin.title_col")}</th>
                    <th className="p-3 font-semibold">{t("admin.category_col")}</th>
                    <th className="p-3 font-semibold">{t("admin.city_col")}</th>
                    <th className="p-3 font-semibold">{t("admin.price_col")}</th>
                    <th className="p-3 font-semibold">{t("admin.views")}</th>
                    <th className="p-3 font-semibold">{t("admin.rating")}</th>
                    <th className="p-3 font-semibold">{t("common.featured")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map(tool => (
                    <tr key={tool.id} className="border-t border-brand-border" data-testid={`admin-tool-${tool.id}`}>
                      <td className="p-3"><Link to={`/tools/${tool.id}`} className="hover:underline font-semibold">{tool.title}</Link></td>
                      <td className="p-3 text-brand-muted capitalize">{tool.category.replace('-', ' ')}</td>
                      <td className="p-3 text-brand-muted">{tool.location?.city}</td>
                      <td className="p-3 font-semibold">${tool.daily_price}/d</td>
                      <td className="p-3 text-brand-muted">{tool.view_count}</td>
                      <td className="p-3">{tool.rating_count > 0 ? `${tool.rating_avg.toFixed(1)} (${tool.rating_count})` : "—"}</td>
                      <td className="p-3">
                        <Switch checked={!!tool.is_featured}
                          onCheckedChange={async () => {
                            try {
                              const r = await api.put(`/admin/tools/${tool.id}/feature`);
                              setTools(tools.map(x => x.id === tool.id ? { ...x, is_featured: r.data.is_featured } : x));
                              toast.success(t("admin.updated"));
                            } catch { toast.error("Failed"); }
                          }}
                          data-testid={`feature-toggle-${tool.id}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="email_log">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mb-4 text-sm">
              ⚠️ <strong>{t("admin.mocked_warning")}</strong> <code>backend/.env</code>.
            </div>
            <div className="space-y-2">
              {emails.map(e => (
                <div key={e.id} className="bg-white border border-brand-border rounded-xl p-4" data-testid={`email-log-${e.id}`}>
                  <div className="flex items-baseline gap-3 mb-1">
                    <div className="font-semibold text-sm">{e.subject}</div>
                    <div className="text-xs text-brand-muted ml-auto">{formatDateTime(e.sent_at, i18n.language)}</div>
                  </div>
                  <div className="text-xs text-brand-muted">to: {e.to}</div>
                  <p className="text-sm mt-1">{e.body}</p>
                </div>
              ))}
              {emails.length === 0 && (
                <div className="bg-white border border-brand-border rounded-2xl p-12 text-center text-brand-muted">{t("admin.no_emails")}</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reviews">
            <div className="bg-white border border-brand-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-subtle text-left">
                  <tr>
                    <th className="p-3 font-semibold">{t("admin.reviewer")}</th>
                    <th className="p-3 font-semibold">{t("admin.target")}</th>
                    <th className="p-3 font-semibold">{t("admin.rating")}</th>
                    <th className="p-3 font-semibold">{t("booking.comment")}</th>
                    <th className="p-3 font-semibold">{t("admin.posted")}</th>
                    <th className="p-3 font-semibold">{t("admin.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map(rv => (
                    <tr key={rv.id} className={`border-t border-brand-border ${rv.hidden ? "opacity-50" : ""}`} data-testid={`admin-review-${rv.id}`}>
                      <td className="p-3 font-semibold">{rv.reviewer_name}</td>
                      <td className="p-3 text-brand-muted">
                        <Badge className="bg-brand-subtle text-brand-text border-0 capitalize mr-1">{rv.target_type}</Badge>
                        {rv.target_type === "tool" ? rv.tool_title : rv.target_user_name}
                      </td>
                      <td className="p-3">
                        <div className="flex">
                          {[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= rv.rating ? 'fill-brand-secondary text-brand-secondary' : 'text-brand-border'}`} />)}
                        </div>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="text-xs line-clamp-2">{rv.comment || "—"}</div>
                        {rv.condition_tag && (
                          <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-brand-subtle text-brand-text px-1.5 py-0.5 rounded-full">
                            {t(`booking.condition_${rv.condition_tag}`)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-brand-muted">{formatDate(rv.created_at, i18n.language)}</td>
                      <td className="p-3">
                        <Button size="sm" variant={rv.hidden ? "default" : "outline"}
                          onClick={() => toggleHideReview(rv.id)}
                          data-testid={`hide-review-${rv.id}`}
                          className="rounded-lg">
                          {rv.hidden ? <><Eye className="w-3 h-3 mr-1" /> {t("admin.unhide")}</> : <><EyeOff className="w-3 h-3 mr-1" /> {t("admin.hide")}</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {reviews.length === 0 && (
                    <tr><td colSpan={6} className="p-12 text-center text-brand-muted">{t("admin.no_reviews")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white border border-brand-border rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-xs uppercase tracking-wider text-brand-muted font-bold">{label}</div>
      </div>
      <div className="font-heading text-3xl font-extrabold">{value}</div>
      {sub && <div className="text-xs text-brand-muted mt-1">{sub}</div>}
    </div>
  );
}
