import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Sparkles, ShieldCheck, Calendar, Wrench, Hammer, Drill, Sprout, Trees, PaintRoller, Pipette, Car, Zap, SprayCan, MoveVertical, Truck, Tent, ArrowRight } from "lucide-react";

const ICONS = { Drill, Wrench, Sprout, Trees, PaintRoller, Pipette, Car, Hammer, Zap, SprayCan, MoveVertical, Truck, Tent };

export default function Landing() {
  const nav = useNavigate();
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    api.get("/categories").then(r => setCategories(r.data)).catch(() => {});
    api.get("/tools", { params: { limit: 8 } }).then(r => setFeatured(r.data)).catch(() => {});
  }, []);

  const doSearch = (e) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    nav(`/browse?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1561297331-a9c00b9c2c44?w=2000&q=80&auto=format"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1A201D]/80 via-[#1A201D]/50 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-[#FDFCF7]" />
              <span className="text-xs font-semibold tracking-wider uppercase text-[#FDFCF7]">North America's tool-sharing community</span>
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.05] text-balance">
              Borrow tools from <span className="text-brand-secondary">your neighbours.</span>
            </h1>
            <p className="mt-6 text-lg text-white/85 max-w-xl leading-relaxed">
              Why buy a tile saw for one weekend? Rent the gear you need from people nearby — pickup or delivery, all in one place.
            </p>

            <form onSubmit={doSearch} className="mt-8 bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-2xl max-w-2xl">
              <div className="flex-1 flex items-center px-4">
                <Search className="w-5 h-5 text-brand-muted mr-3" />
                <Input
                  value={q} onChange={(e) => setQ(e.target.value)}
                  data-testid="hero-search-input"
                  placeholder="What do you need? e.g. drill, ladder, mower"
                  className="border-0 focus-visible:ring-0 px-0 text-base h-12"
                />
              </div>
              <div className="hidden sm:block w-px bg-brand-border my-2" />
              <div className="flex items-center px-4 sm:w-48">
                <MapPin className="w-5 h-5 text-brand-muted mr-3" />
                <Input
                  value={city} onChange={(e) => setCity(e.target.value)}
                  data-testid="hero-city-input"
                  placeholder="City"
                  className="border-0 focus-visible:ring-0 px-0 text-base h-12"
                />
              </div>
              <Button type="submit" data-testid="hero-search-btn"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-semibold h-12 px-8">
                Search
              </Button>
            </form>

            <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/80">
              <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Verified owners</div>
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Flexible booking</div>
              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI tool finder</div>
            </div>
          </div>
        </div>
      </section>

      {/* AI ASSISTANT BANNER */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 mt-16">
        <div className="bg-brand-primary text-white rounded-3xl overflow-hidden relative">
          <div className="grid md:grid-cols-2">
            <div className="p-10 md:p-14">
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-wider">AI Tool Assistant</span>
              </div>
              <h2 className="font-heading text-3xl md:text-4xl font-extrabold leading-tight mb-4">
                Not sure what you need?<br/>Describe your project.
              </h2>
              <p className="text-white/80 mb-6 leading-relaxed">
                "I need to build a fence." "I want to fix a leaky sink." Our AI maps your task to the exact tools you need — and finds them nearby.
              </p>
              <Button asChild data-testid="ai-cta-btn"
                className="bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold">
                <Link to="/ai">Try AI Assistant <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
            </div>
            <div className="hidden md:block relative">
              <img
                src="https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=1200&q=80&auto=format"
                alt="AI tool finder"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-brand-primary" />
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 mt-24">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-muted mb-2">Browse</div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold">By category</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((c) => {
            const Icon = ICONS[c.icon] || Wrench;
            return (
              <Link key={c.slug} to={`/browse?category=${c.slug}`}
                data-testid={`category-${c.slug}`}
                className="group bg-white border border-brand-border rounded-2xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-3 group-hover:bg-brand-primary group-hover:text-white transition-colors text-brand-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-heading font-semibold text-brand-text text-sm">{c.name}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FEATURED */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 md:px-8 mt-24">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-muted mb-2">Available now</div>
              <h2 className="font-heading text-3xl md:text-4xl font-bold">Featured tools</h2>
            </div>
            <Link to="/browse" className="text-sm font-semibold text-brand-primary hover:underline" data-testid="see-all-tools">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.slice(0, 8).map(t => <ToolCard key={t.id} tool={t} />)}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 mt-24">
        <div className="text-center mb-12">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-muted mb-2">How it works</div>
          <h2 className="font-heading text-3xl md:text-4xl font-bold">Three steps to your next project</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "01", t: "Find a tool", d: "Search by category, location or describe your task and let AI pick for you." },
            { n: "02", t: "Book the dates", d: "Send a request, chat with the owner, agree on pickup or delivery." },
            { n: "03", t: "Build something great", d: "Pick up your tool, complete your project, leave a review." }
          ].map(s => (
            <div key={s.n} className="bg-white border border-brand-border rounded-2xl p-8">
              <div className="font-heading text-5xl font-extrabold text-brand-primary/15 mb-2">{s.n}</div>
              <h3 className="font-heading text-xl font-bold mb-2">{s.t}</h3>
              <p className="text-brand-muted leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 mt-24 mb-16">
        <div className="bg-white border border-brand-border rounded-3xl p-12 md:p-16 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-extrabold mb-4">Got tools collecting dust?</h2>
          <p className="text-brand-muted max-w-xl mx-auto mb-8">
            Turn your garage into income. List your tools in 5 minutes and start earning from your neighbourhood.
          </p>
          <Button asChild data-testid="cta-list-tool"
            className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-semibold h-12 px-8">
            <Link to="/list">List your first tool</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
