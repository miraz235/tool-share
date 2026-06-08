import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth.jsx";
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

function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

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
        const res = await api.post("/auth/google/session", { session_id: sessionId });
        if (res.data.token) setToken(res.data.token);
        // Clean URL and go to dashboard
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true });
        window.location.reload();
      } catch (e) {
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
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
