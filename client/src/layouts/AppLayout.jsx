import { LogOut, Plus } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/index.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { useAuth } from '../store/authStore.js';

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 text-slate-900">
      <span className="flex h-6 w-6 flex-col justify-center gap-[3px] rounded-[5px] bg-brand-600 px-[5px]" aria-hidden>
        <span className="h-[2px] w-full bg-white" />
        <span className="h-[2px] w-full bg-white" />
        <span className="h-[2px] w-2/3 bg-white" />
      </span>
      <span className="font-display text-lg font-semibold">AI Form Builder</span>
    </Link>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Logo to="/dashboard" />
            <nav aria-label="Main" className="hidden sm:block">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`
                }
              >
                Forms
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" onClick={() => navigate('/create')}>
              <Plus className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">New form</span>
            </Button>
            <span className="hidden max-w-[10rem] truncate text-sm text-slate-500 md:block" title={user?.email}>
              {user?.name || user?.email}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Log out"
              onClick={async () => { await logout(); navigate('/'); }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </header>
      <main id="main"><Outlet /></main>
    </div>
  );
}
