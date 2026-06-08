import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth.jsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Wrench, Search, Sparkles, Plus, LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";

export default function Header() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

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
            <Search className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Browse
          </Link>
          <Link to="/ai" data-testid="nav-ai"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${loc.pathname === '/ai' ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-muted hover:text-brand-text hover:bg-brand-subtle'}`}>
            <Sparkles className="w-4 h-4 inline mr-1.5 -mt-0.5" /> AI Assistant
          </Link>
          {user && (
            <Link to="/dashboard" data-testid="nav-dashboard"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${loc.pathname === '/dashboard' ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-muted hover:text-brand-text hover:bg-brand-subtle'}`}>
              <LayoutDashboard className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild
                className="hidden sm:inline-flex bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold"
                data-testid="header-list-tool-btn">
                <Link to="/list"><Plus className="w-4 h-4 mr-1" /> List a tool</Link>
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
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav(`/profile/${user.id}`)} data-testid="menu-profile">
                    <UserIcon className="w-4 h-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav("/list")} data-testid="menu-list">
                    <Plus className="w-4 h-4 mr-2" /> List a tool
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await logout(); nav("/"); }} data-testid="menu-logout">
                    <LogOut className="w-4 h-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="rounded-xl text-brand-text hover:bg-brand-subtle" data-testid="header-login-btn">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-semibold" data-testid="header-signup-btn">
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
