import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench } from "lucide-react";

const GoogleIcon = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
    <path d="M21.6 12.227c0-.708-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.232c1.891-1.742 2.981-4.305 2.981-7.351Z" fill="#4285F4"/>
    <path d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.232-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.595-4.125H3.064v2.59A9.997 9.997 0 0 0 12 22Z" fill="#34A853"/>
    <path d="M6.405 13.898A6.005 6.005 0 0 1 6.09 12c0-.659.114-1.3.314-1.898v-2.59H3.064A9.996 9.996 0 0 0 2 12c0 1.614.386 3.14 1.064 4.488l3.341-2.59Z" fill="#FBBC05"/>
    <path d="M12 5.977c1.468 0 2.786.504 3.823 1.495l2.869-2.868C16.96 2.99 14.697 2 12 2A9.997 9.997 0 0 0 3.064 7.512l3.341 2.59C7.19 7.736 9.395 5.977 12 5.977Z" fill="#EA4335"/>
  </svg>
);

export default function Register() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error(t("auth.password_short"));
      return;
    }
    setSubmitting(true);
    try {
      await register(form.email, form.password, form.name);
      toast.success(t("auth.welcome_new"));
      nav("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || t("auth.register_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const googleSignIn = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-primary items-center justify-center mb-4">
            <Wrench className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-heading text-3xl font-extrabold">{t("auth.join")}</h1>
          <p className="text-brand-muted mt-1">{t("auth.join_sub")}</p>
        </div>

        <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-sm">
          <Button onClick={googleSignIn} variant="outline" data-testid="google-signin-btn"
            className="w-full h-12 rounded-xl border-brand-border font-semibold">
            <GoogleIcon className="mr-2" /> {t("auth.continue_google")}
          </Button>

          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="px-3 text-xs uppercase tracking-wider text-brand-muted font-bold">{t("auth.or")}</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>{t("auth.name")}</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                required data-testid="register-name" className="rounded-xl mt-1 h-11"/>
            </div>
            <div>
              <Label>{t("auth.email")}</Label>
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                required data-testid="register-email" className="rounded-xl mt-1 h-11"/>
            </div>
            <div>
              <Label>{t("auth.password")}</Label>
              <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                required minLength={6} data-testid="register-password" className="rounded-xl mt-1 h-11"/>
              <p className="text-xs text-brand-muted mt-1">{t("auth.password_min")}</p>
            </div>
            <Button type="submit" disabled={submitting} data-testid="register-submit"
              className="w-full h-11 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-semibold">
              {submitting ? t("auth.creating") : t("auth.create_account")}
            </Button>
          </form>

          <p className="text-sm text-center text-brand-muted mt-6">
            {t("auth.have_account")} <Link to="/login" className="text-brand-primary font-semibold hover:underline" data-testid="go-to-login">{t("nav.sign_in")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
