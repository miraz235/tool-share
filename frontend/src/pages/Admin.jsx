import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth.jsx";
import Header from "@/components/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Package, Calendar, DollarSign, AlertCircle, ShieldCheck, Search, Mail } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tools, setTools] = useState([]);
  const [emails, setEmails] = useState([]);
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
  };

  useEffect(() => { if (user?.is_admin) refresh(); }, [user]);

  const toggle = async (uid, field, value) => {
    try {
      await api.put(`/admin/users/${uid}`, { [field]: value });
      setUsers(users.map(u => u.id === uid ? { ...u, [field]: value } : u));
      toast.success("Updated");
    } catch { toast.error("Failed"); }
  };

  const toggleDispute = async (bid) => {
    try {
      const r = await api.put(`/admin/bookings/${bid}/dispute`);
      setBookings(bookings.map(b => b.id === bid ? { ...b, dispute_open: r.data.dispute_open } : b));
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
            <div className="text-xs uppercase tracking-[0.2em] text-brand-muted font-bold mb-1">Admin</div>
            <h1 className="font-heading text-4xl font-extrabold">Platform overview</h1>
          </div>
          <Badge className="bg-brand-primary/10 text-brand-primary border-0">
            <ShieldCheck className="w-3 h-3 mr-1" /> Administrator
          </Badge>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Users} label="Users" value={stats.users} sub={`${stats.verified_users} verified`} />
            <StatCard icon={Package} label="Listings" value={stats.tools} />
            <StatCard icon={Calendar} label="Bookings" value={stats.bookings_total} sub={`${stats.approved_bookings} approved`} />
            <StatCard icon={DollarSign} label="Platform revenue" value={`$${stats.revenue}`} sub={`$${stats.pending_payouts} owed`} />
          </div>
        )}

        <Tabs defaultValue="users">
          <TabsList className="bg-white border border-brand-border rounded-xl p-1 mb-6">
            <TabsTrigger value="users" data-testid="admin-tab-users" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-1.5" /> Users
            </TabsTrigger>
            <TabsTrigger value="bookings" data-testid="admin-tab-bookings" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-1.5" /> Bookings
            </TabsTrigger>
            <TabsTrigger value="tools" data-testid="admin-tab-tools" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-1.5" /> Tools
            </TabsTrigger>
            <TabsTrigger value="email_log" data-testid="admin-tab-emails" className="rounded-lg data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Mail className="w-4 h-4 mr-1.5" /> Email log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="mb-4 flex items-center gap-2 bg-white border border-brand-border rounded-xl px-3 max-w-md">
              <Search className="w-4 h-4 text-brand-muted" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') refresh(); }}
                placeholder="Search by name or email"
                data-testid="admin-search-input"
                className="border-0 focus-visible:ring-0 px-0 h-10"/>
            </div>
            <div className="bg-white border border-brand-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-subtle text-left">
                  <tr>
                    <th className="p-3 font-semibold">User</th>
                    <th className="p-3 font-semibold">Joined</th>
                    <th className="p-3 font-semibold">Verified</th>
                    <th className="p-3 font-semibold">Admin</th>
                    <th className="p-3 font-semibold">Suspended</th>
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
                      <td className="p-3 text-brand-muted">{u.created_at?.slice(0, 10)}</td>
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
                    <th className="p-3 font-semibold">Tool</th>
                    <th className="p-3 font-semibold">Renter</th>
                    <th className="p-3 font-semibold">Owner</th>
                    <th className="p-3 font-semibold">Dates</th>
                    <th className="p-3 font-semibold">Total</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Paid</th>
                    <th className="p-3 font-semibold">Dispute</th>
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
                      <td className="p-3 text-xs text-brand-muted">{b.start_date} → {b.end_date}</td>
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
                    <th className="p-3 font-semibold">Title</th>
                    <th className="p-3 font-semibold">Category</th>
                    <th className="p-3 font-semibold">City</th>
                    <th className="p-3 font-semibold">Price</th>
                    <th className="p-3 font-semibold">Views</th>
                    <th className="p-3 font-semibold">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map(t => (
                    <tr key={t.id} className="border-t border-brand-border" data-testid={`admin-tool-${t.id}`}>
                      <td className="p-3"><Link to={`/tools/${t.id}`} className="hover:underline font-semibold">{t.title}</Link></td>
                      <td className="p-3 text-brand-muted capitalize">{t.category.replace('-', ' ')}</td>
                      <td className="p-3 text-brand-muted">{t.location?.city}</td>
                      <td className="p-3 font-semibold">${t.daily_price}/d</td>
                      <td className="p-3 text-brand-muted">{t.view_count}</td>
                      <td className="p-3">{t.rating_count > 0 ? `${t.rating_avg.toFixed(1)} (${t.rating_count})` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="email_log">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mb-4 text-sm">
              ⚠️ <strong>MOCKED:</strong> Email notifications are logged here only. To send real emails, provide a Resend API key in <code>backend/.env</code>.
            </div>
            <div className="space-y-2">
              {emails.map(e => (
                <div key={e.id} className="bg-white border border-brand-border rounded-xl p-4" data-testid={`email-log-${e.id}`}>
                  <div className="flex items-baseline gap-3 mb-1">
                    <div className="font-semibold text-sm">{e.subject}</div>
                    <div className="text-xs text-brand-muted ml-auto">{e.sent_at?.slice(0, 19).replace('T', ' ')}</div>
                  </div>
                  <div className="text-xs text-brand-muted">to: {e.to}</div>
                  <p className="text-sm mt-1">{e.body}</p>
                </div>
              ))}
              {emails.length === 0 && (
                <div className="bg-white border border-brand-border rounded-2xl p-12 text-center text-brand-muted">No emails sent yet.</div>
              )}
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
