import { useEffect } from 'react';
import { api, setToken } from '@/lib/api';
import { Outlet, Route, RootRoute, Router, RouterProvider } from '@tanstack/react-router';
import { createBrowserHistory } from '@tanstack/react-router';
import Header from '@/components/Header';
import Landing from '@/pages/Landing';
import Browse from '@/pages/Browse';
import ToolDetail from '@/pages/ToolDetail';
import ListTool from '@/pages/ListTool';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Profile from '@/pages/Profile';
import AIAssistant from '@/pages/AIAssistant';
import BookingDetail from '@/pages/BookingDetail';
import Messages from '@/pages/Messages';
import Admin from '@/pages/Admin';

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
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      window.location.replace('/');
      return;
    }
    const sessionId = match[1];

    (async () => {
      try {
        const res = await api.post<{ token: string }>('/auth/google/session', {
          session_id: sessionId,
        });
        if (res.data.token) {
          setToken(res.data.token);
        }
        window.history.replaceState({}, '', '/dashboard');
        window.location.replace('/dashboard');
      } catch {
        window.location.replace('/login');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="text-center" data-testid="auth-callback-loading">
        <div className="h-8 w-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-brand-muted">Signing you in…</p>
      </div>
    </div>
  );
}

function RootLayout() {
  if (typeof window !== 'undefined' && window.location.hash.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <div className="App">
      <Header />
      <Outlet />
    </div>
  );
}

const rootRoute = new RootRoute({
  component: RootLayout,
});

const landingRoute = new Route({
  getParent: () => rootRoute,
  path: '/',
  component: Landing,
});

const browseRoute = new Route({
  getParent: () => rootRoute,
  path: '/browse',
  component: Browse,
});

const toolDetailRoute = new Route({
  getParent: () => rootRoute,
  path: '/tools/:id',
  component: ToolDetail,
});

const listRoute = new Route({
  getParent: () => rootRoute,
  path: '/list',
  component: ListTool,
});

const dashboardRoute = new Route({
  getParent: () => rootRoute,
  path: '/dashboard',
  component: Dashboard,
});

const loginRoute = new Route({
  getParent: () => rootRoute,
  path: '/login',
  component: Login,
});

const registerRoute = new Route({
  getParent: () => rootRoute,
  path: '/register',
  component: Register,
});

const profileRoute = new Route({
  getParent: () => rootRoute,
  path: '/profile/:id',
  component: Profile,
});

const aiRoute = new Route({
  getParent: () => rootRoute,
  path: '/ai',
  component: AIAssistant,
});

const bookingDetailRoute = new Route({
  getParent: () => rootRoute,
  path: '/bookings/:id',
  component: BookingDetail,
});

const messagesRoute = new Route({
  getParent: () => rootRoute,
  path: '/messages',
  component: Messages,
});

const adminRoute = new Route({
  getParent: () => rootRoute,
  path: '/admin',
  component: Admin,
});

const notFoundRoute = new Route({
  getParent: () => rootRoute,
  path: '*',
  component: NotFound,
});

const routeTree = rootRoute.addChildren([
  landingRoute,
  browseRoute,
  toolDetailRoute,
  listRoute,
  dashboardRoute,
  loginRoute,
  registerRoute,
  profileRoute,
  aiRoute,
  bookingDetailRoute,
  messagesRoute,
  adminRoute,
  notFoundRoute,
]);

export const router = new Router({
  routeTree,
  history: createBrowserHistory(),
});

export function AppRouter() {
  return <RouterProvider router={router} />;
}
