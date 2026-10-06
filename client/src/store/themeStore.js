import { create } from 'zustand';

const KEY = 'afb.theme';

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

const systemTheme = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

function apply(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

const initial = readStored() ?? systemTheme();
apply(initial);

export const useTheme = create((set, get) => ({
  theme: initial,
  toggle() {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch { /* storage unavailable */ }
    set({ theme: next });
  },
}));
