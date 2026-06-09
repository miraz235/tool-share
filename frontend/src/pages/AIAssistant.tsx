import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import Header from "@/components/Header";
import { api, imageUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Wrench, ShieldAlert, Clock, Gauge, ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";

const EXAMPLES_BY_LANG = {
  en: [
    "I need to build a fence around my backyard",
    "I want to cut down some tree branches",
    "Fix a leaking sink in my bathroom",
    "Paint my living room walls",
    "Install new tile in the kitchen",
  ],
  fr: [
    "Je dois construire une clôture autour de mon jardin",
    "Je veux couper quelques branches d'arbre",
    "Réparer un évier qui fuit dans ma salle de bain",
    "Peindre les murs de mon salon",
    "Poser du carrelage dans la cuisine",
  ],
  es: [
    "Necesito construir una cerca alrededor de mi patio",
    "Quiero cortar algunas ramas de árbol",
    "Reparar un grifo que gotea en mi baño",
    "Pintar las paredes de la sala",
    "Instalar azulejos nuevos en la cocina",
  ],
};

export default function AIAssistant() {
  const { t, i18n } = useTranslation();
  const { format } = useCurrency();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const EXAMPLES = EXAMPLES_BY_LANG[i18n.language?.split("-")[0]] || EXAMPLES_BY_LANG.en;
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [quota, setQuota] = useState(null); // { remaining, total, unlimited }
  const [quotaErr, setQuotaErr] = useState("");

  useEffect(() => {
    if (!user) return;
    api.get("/ai/quota").then(r => setQuota(r.data)).catch(() => {});
  }, [user]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!task.trim()) return;
    if (!user) { nav("/login?next=/ai"); return; }
    if (quota && !quota.unlimited && quota.remaining <= 0) {
      setQuotaErr(t("ai.quota_exceeded"));
      return;
    }
    setLoading(true);
    setResult(null);
    setQuotaErr("");
    try {
      const res = await api.post("/ai/recommend", { task });
      setResult(res.data);
      if (res.data?.quota) setQuota(res.data.quota);
    } catch (err) {
      if (err?.response?.status === 429) {
        const detail = err.response.data?.detail;
        const msg = typeof detail === "object" ? detail.message : detail;
        setQuotaErr(msg || t("ai.quota_exceeded"));
        if (typeof detail === "object") {
          setQuota({ remaining: 0, total: detail.total, unlimited: false });
        }
      } else {
        toast.error(t("ai.ai_error"));
      }
    } finally {
      setLoading(false);
    }
  };

  const difficultyColor = {
    Easy: "bg-green-100 text-green-800",
    Moderate: "bg-yellow-100 text-yellow-800",
    Advanced: "bg-red-100 text-red-800",
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-brand-primary text-white rounded-full px-4 py-1.5 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-bold uppercase tracking-wider">{t("ai.tag")}</span>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold mb-3 text-balance">{t("ai.title")}</h1>
          <p className="text-brand-muted text-lg max-w-xl mx-auto">{t("ai.subtitle")}</p>
          {user && quota && !quota.unlimited && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white border border-brand-border rounded-full px-3 py-1 text-xs font-semibold text-brand-muted" data-testid="ai-quota-counter">
              <Gauge className="w-3 h-3" />
              {t("ai.quota_label", { remaining: quota.remaining, total: quota.total })}
            </div>
          )}
          {user && quota?.unlimited && (
            <div className="mt-4 inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-full px-3 py-1 text-xs font-bold" data-testid="ai-quota-unlimited">
              <Sparkles className="w-3 h-3" /> {t("ai.unlimited")}
            </div>
          )}
        </div>

        {!user && !authLoading && (
          <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-2xl p-5 mb-6 flex items-start gap-3" data-testid="ai-login-gate">
            <Lock className="w-5 h-5 text-brand-primary mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold mb-1">{t("ai.login_required_title")}</div>
              <p className="text-sm text-brand-muted mb-3">{t("ai.login_required_body")}</p>
              <Link to="/login?next=/ai" className="inline-flex items-center gap-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
                {t("ai.sign_in_cta")} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {quotaErr && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 mb-6 flex items-start gap-2" data-testid="ai-quota-error">
            <ShieldAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm font-medium">{quotaErr}</div>
          </div>
        )}

        <form onSubmit={submit} className="bg-white border border-brand-border rounded-2xl p-6 shadow-sm mb-6">
          <Textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder={t("ai.input_ph")}
            className="border-0 focus-visible:ring-0 min-h-[100px] text-base resize-none p-0"
            data-testid="ai-task-input"
            disabled={!!user && quota && !quota.unlimited && quota.remaining <= 0}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-brand-muted">{task.length} chars</span>
            <Button type="submit" disabled={loading || !task.trim() || (!!user && quota && !quota.unlimited && quota.remaining <= 0)}
              data-testid="ai-submit-btn"
              className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-semibold h-11 px-6">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("ai.thinking")}</> : <>{t("ai.find_tools")} <ArrowRight className="w-4 h-4 ml-1.5" /></>}
            </Button>
          </div>
        </form>

        {!result && !loading && (
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-muted font-bold mb-3">{t("ai.try_one")}</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setTask(ex)}
                  data-testid={`ai-example-${ex.slice(0, 15)}`}
                  className="bg-white border border-brand-border hover:border-brand-primary hover:bg-brand-primary/5 transition-colors rounded-full px-4 py-2 text-sm">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6 animate-fade-up" data-testid="ai-results">
            <div className="bg-brand-primary text-white rounded-2xl p-6">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-white/80 text-sm uppercase tracking-wider font-bold mb-2">{t("ai.your_project")}</p>
                  <h2 className="font-heading text-2xl font-bold leading-tight">{result.summary}</h2>
                </div>
                <div className="flex gap-2">
                  {result.difficulty && (
                    <Badge className={`${difficultyColor[result.difficulty] || 'bg-white/20'} border-0`}>
                      <Gauge className="w-3 h-3 mr-1" /> {result.difficulty}
                    </Badge>
                  )}
                  {result.estimated_time && (
                    <Badge className="bg-white/15 text-white border-0">
                      <Clock className="w-3 h-3 mr-1" /> {result.estimated_time}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-heading text-xl font-bold mb-4">{t("ai.tools_needed")}</h3>
              <div className="space-y-4">
                {result.tools?.map((tool, i) => (
                  <div key={i} className="bg-white border border-brand-border rounded-2xl p-6" data-testid={`ai-tool-${i}`}>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-heading font-bold text-lg">{tool.name}</h4>
                          {tool.essential && <Badge className="bg-brand-secondary/15 text-brand-secondary border-0 text-xs">{t("ai.essential")}</Badge>}
                          <Badge className="bg-brand-subtle text-brand-muted border-0 text-xs capitalize">{t(`categories.${tool.category}`, tool.category?.replace('-', ' '))}</Badge>
                        </div>
                        <p className="text-sm text-brand-muted mt-1">{tool.why}</p>
                      </div>
                    </div>

                    {tool.available_listings?.length > 0 ? (
                      <div className="border-t border-brand-border pt-4">
                        <p className="text-xs uppercase tracking-wider text-brand-muted font-bold mb-3">{t("ai.available_near")}</p>
                        <div className="grid sm:grid-cols-3 gap-3">
                          {tool.available_listings.slice(0, 3).map(l => (
                            <Link key={l.id} to={`/tools/${l.id}`}
                              className="flex items-center gap-3 p-3 bg-brand-subtle rounded-xl hover:bg-white hover:border-brand-primary border border-transparent transition-all">
                              <div className="w-12 h-12 rounded-lg bg-white overflow-hidden shrink-0">
                                {l.images?.[0] && <img src={imageUrl(l.images[0])} className="w-full h-full object-cover" alt="" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-sm truncate">{l.title}</div>
                                <div className="text-xs text-brand-muted">{format(l.daily_price)}/{t("common.day")} · {l.location?.city}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-brand-border pt-4 text-sm text-brand-muted">
                        {t("ai.no_nearby")} <Link to={`/browse?category=${tool.category}`} className="text-brand-primary font-semibold">{t(`categories.${tool.category}`, tool.category?.replace('-', ' '))}</Link> {t("ai.category")}.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {result.safety_tips?.length > 0 && (
              <div className="bg-white border border-brand-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-brand-secondary" />
                  <h3 className="font-heading font-bold">{t("ai.safety_tips")}</h3>
                </div>
                <ul className="space-y-1.5 text-sm text-brand-muted list-disc list-inside">
                  {result.safety_tips.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
