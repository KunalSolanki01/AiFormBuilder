import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../store/themeStore.js';
import { cn } from './index.jsx';

/** Sun/moon switch. Exposed as a real switch for assistive tech. */
export function ThemeToggle({ className }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border border-slate-300 bg-slate-100 transition-colors',
        dark && 'bg-brand-600 border-brand-600',
        className,
      )}
    >
      <Sun className="absolute left-1.5 h-4 w-4 text-amber-500" aria-hidden />
      <Moon className="absolute right-1.5 h-4 w-4 text-slate-400" aria-hidden />
      <span
        className={cn(
          'absolute left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
          dark && 'translate-x-6',
        )}
      />
    </button>
  );
}
