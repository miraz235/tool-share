import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, ShieldCheck, MapPin, Calendar } from "lucide-react";

export default function Profile() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [tools, setTools] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    api.get(`/users/${id}`).then(r => setUser(r.data));
    api.get(`/tools`, { params: { owner_id: id } }).then(r => setTools(r.data));
    api.get(`/reviews`, { params: { user_id: id } }).then(r => setReviews(r.data));
  }, [id]);

  if (!user) return (<div className="min-h-screen bg-brand-bg"><Header /><div className="p-16 text-center text-brand-muted">Loading…</div></div>);

  const initials = user.name?.split(" ").map(n => n[0]).slice(0, 2).join("");
  const joined = user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—";

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12">
        <div className="bg-white border border-brand-border rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-start gap-6">
          <Avatar className="h-24 w-24">
            {user.picture && <AvatarImage src={user.picture} />}
            <AvatarFallback className="bg-brand-primary text-white font-heading font-bold text-3xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-heading text-3xl font-extrabold" data-testid="profile-name">{user.name}</h1>
              {user.is_verified && (
                <span className="inline-flex items-center gap-1 bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full text-xs font-bold">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-brand-muted">
              {user.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {user.city}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {joined}</span>
              {user.rating_count > 0 && (
                <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-brand-secondary text-brand-secondary" /> {user.rating_avg.toFixed(1)} ({user.rating_count} reviews)</span>
              )}
            </div>
            {user.bio && <p className="text-brand-muted mt-4 leading-relaxed">{user.bio}</p>}
          </div>
        </div>

        <h2 className="font-heading text-2xl font-bold mb-4">{user.name.split(" ")[0]}'s tools ({tools.length})</h2>
        {tools.length === 0 ? (
          <div className="bg-white border border-brand-border rounded-2xl p-12 text-center text-brand-muted">No listings yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {tools.map(t => <ToolCard key={t.id} tool={t} />)}
          </div>
        )}

        {reviews.length > 0 && (
          <>
            <h2 className="font-heading text-2xl font-bold mb-4">Reviews ({reviews.length})</h2>
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="bg-white border border-brand-border rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-8 w-8">
                      {r.reviewer?.picture && <AvatarImage src={r.reviewer.picture} />}
                      <AvatarFallback className="text-xs">{r.reviewer?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="font-semibold text-sm">{r.reviewer?.name}</div>
                    <div className="flex ml-auto">
                      {[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? 'fill-brand-secondary text-brand-secondary' : 'text-brand-border'}`} />)}
                    </div>
                  </div>
                  <p className="text-sm text-brand-muted">{r.comment}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
