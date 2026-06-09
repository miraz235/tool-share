import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Wrench, Search, Sparkles, Plus, LogOut, LayoutDashboard, User as UserIcon, MessageSquare, Shield } from "lucide-react";

export default function Header() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = () => api.get("/messages/unread/count").then(r => setUnread(r.data.count)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user]);

  const initials = user?.name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 glass-header border-b border-brand-border/60">
      <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="header-logo">
          <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-heading font-extrabold text-xl text-brand-text tracking-tight">ToolShare</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/browse" data-testid="nav-browse"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${loc.pathname === '/browse' ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-muted hover:text-brand-text hover:bg-brand-subtle'}`}>
            <Search className="w-4 h-4 inline mr-1.5 -mt-0.5" /> {t("nav.browse")}
          </Link>
          <Link to="/ai" data-testid="nav-ai"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${loc.pathname === '/ai' ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-muted hover:text-brand-text hover:bg-brand-subtle'}`}>
            <Sparkles className="w-4 h-4 inline mr-1.5 -mt-0.5" /> {t("nav.ai_assistant")}
          </Link>
          {user && (
            <Link to="/dashboard" data-testid="nav-dashboard"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${loc.pathname === '/dashboard' ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-muted hover:text-brand-text hover:bg-brand-subtle'}`}>
              <LayoutDashboard className="w-4 h-4 inline mr-1.5 -mt-0.5" /> {t("nav.dashboard")}
            </Link>
          )}
          {user && (
            <Link to="/messages" data-testid="nav-messages"
              className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-colors ${loc.pathname === '/messages' ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-muted hover:text-brand-text hover:bg-brand-subtle'}`}>
              <MessageSquare className="w-4 h-4 inline mr-1.5 -mt-0.5" /> {t("nav.messages")}
              {unread > 0 && <Badge className="absolute -top-1 -right-1 bg-brand-secondary text-white border-0 text-[10px] h-4 min-w-[16px] px-1">{unread}</Badge>}
            </Link>
          )}
          {user?.is_admin && (
            <Link to="/admin" data-testid="nav-admin"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${loc.pathname === '/admin' ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-muted hover:text-brand-text hover:bg-brand-subtle'}`}>
              <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" /> {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <>
              <Button asChild
                className="hidden sm:inline-flex bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold"
                data-testid="header-list-tool-btn">
                <Link to="/list"><Plus className="w-4 h-4 mr-1" /> {t("nav.list_a_tool")}</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger data-testid="header-user-menu" className="outline-none">
                  <Avatar className="h-10 w-10 ring-2 ring-brand-border hover:ring-brand-primary transition-all">
                    {user.picture && <AvatarImage src={user.picture} alt={user.name} />}
                    <AvatarFallback className="bg-brand-primary text-white font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-heading">
                    <div>{user.name}</div>
                    <div className="text-xs text-brand-muted font-normal">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => nav("/dashboard")} data-testid="menu-dashboard">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> {t("nav.dashboard")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav(`/profile/${user.id}`)} data-testid="menu-profile">
                    <UserIcon className="w-4 h-4 mr-2" /> {t("nav.profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav("/list")} data-testid="menu-list">
                    <Plus className="w-4 h-4 mr-2" /> {t("nav.list_a_tool")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await logout(); nav("/"); }} data-testid="menu-logout">
                    <LogOut className="w-4 h-4 mr-2" /> {t("nav.sign_out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="rounded-xl text-brand-text hover:bg-brand-subtle" data-testid="header-login-btn">
                <Link to="/login">{t("nav.sign_in")}</Link>
              </Button>
              <Button asChild className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-semibold" data-testid="header-signup-btn">
                <Link to="/register">{t("nav.get_started")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
