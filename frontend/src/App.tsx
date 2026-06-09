import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { CurrencyProvider } from "@/lib/currency";
import { api, setToken } from "@/lib/api";

import Landing from "@/pages/Landing";
import Browse from "@/pages/Browse";
import ToolDetail from "@/pages/ToolDetail";
import ListTool from "@/pages/ListTool";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Profile from "@/pages/Profile";
import AIAssistant from "@/pages/AIAssistant";
import BookingDetail from "@/pages/BookingDetail";
import Messages from "@/pages/Messages";
import Admin from "@/pages/Admin";
import Header from "@/components/Header";

function NotFound() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center" data-testid="not-found-page">
        <div className="font-heading text-6xl font-extrabold text-brand-primary">404</div>
        <h1 className="font-heading text-2xl font-bold mt-3 mb-2">Page not found</h1>
        <p className="text-brand-muted mb-6 max-w-md">
          The page you're looking for doesn't exist or has moved. Try browsing our tools instead.
        </p>
        <a href="/browse" className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl px-5 py-2.5 font-semibold transition-colors">
          Browse tools
        </a>
      </div>
    </div>
  );
}

function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef<boolean>(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/", { replace: true });
      return;
    }
    const sessionId = match[1];

    (async () => {
      try {
        const res = await api.post<{ token: string }>("/auth/google/session", { session_id: sessionId });
        if (res.data.token) setToken(res.data.token);
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true });
        window.location.reload();
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="text-center" data-testid="auth-callback-loading">
        <div className="h-8 w-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-brand-muted">Signing you in…</p>
      </div>
    </div>
  );
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/browse" element={<Browse />} />
      <Route path="/tools/:id" element={<ToolDetail />} />
      <Route path="/list" element={<ListTool />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile/:id" element={<Profile />} />
      <Route path="/ai" element={<AIAssistant />} />
      <Route path="/bookings/:id" element={<BookingDetail />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
            <AppRouter />
            <Toaster position="top-right" richColors />
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
