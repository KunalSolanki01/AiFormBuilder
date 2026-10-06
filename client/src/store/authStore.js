import { create } from 'zustand';
import { api, session, setSessionExpiredHandler } from '../services/api.js';

export const useAuth = create((set, get) => ({
  user: null,
  /** True until the stored session has been checked once. */
  loading: Boolean(session.get()),

  async init() {
    if (!session.get()) return set({ loading: false });
    try {
      set({ user: await api.auth.me(), loading: false });
    } catch {
      session.clear();
      set({ user: null, loading: false });
    }
  },

  async login(credentials) {
    const { user, session: s } = await api.auth.login(credentials);
    session.set(s);
    set({ user });
  },

  /** @returns {Promise<{requiresConfirmation: boolean}>} */
  async register(data) {
    const { user, session: s, requires_confirmation } = await api.auth.register(data);
    if (s) {
      session.set(s);
      set({ user });
    }
    return { requiresConfirmation: Boolean(requires_confirmation) };
  },

  async logout() {
    await api.auth.logout();
    session.clear();
    set({ user: null });
  },

  clear() {
    session.clear();
    if (get().user) set({ user: null });
  },
}));

setSessionExpiredHandler(() => useAuth.getState().clear());
