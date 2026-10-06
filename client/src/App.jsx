import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Spinner } from './components/ui/index.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import { Privacy, Terms } from './pages/Legal.jsx';
import { Login, Register } from './pages/Auth.jsx';
import PublicForm from './pages/PublicForm.jsx';
import { useAuth } from './store/authStore.js';

// Heavy routes (dnd-kit, recharts) are split out.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const CreateForm = lazy(() => import('./pages/CreateForm.jsx'));
const FormBuilder = lazy(() => import('./pages/FormBuilder.jsx'));
const FormPreview = lazy(() => import('./pages/FormPreview.jsx'));
const Responses = lazy(() => import('./pages/Responses.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));

const Loading = () => (
  <div className="flex min-h-[50vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>
);

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/forms/:slug" element={<PublicForm />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create" element={<CreateForm />} />
            <Route path="/builder/:id" element={<FormBuilder />} />
            <Route path="/builder/:id/preview" element={<FormPreview />} />
            <Route path="/builder/:id/responses" element={<Responses />} />
            <Route path="/builder/:id/analytics" element={<Analytics />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
