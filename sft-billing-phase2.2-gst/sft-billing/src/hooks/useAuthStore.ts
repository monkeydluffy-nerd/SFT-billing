import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getApiBaseUrl } from "@/services/backendPort";

const fallbackAuthStorage = new Map<string, string>();

const authStorage = {
  getItem: (name: string) => {
    const storage = getBrowserStorage();
    return storage?.getItem(name) ?? fallbackAuthStorage.get(name) ?? null;
  },
  setItem: (name: string, value: string) => {
    const storage = getBrowserStorage();
    if (storage) {
      storage.setItem(name, value);
      fallbackAuthStorage.delete(name);
    } else {
      fallbackAuthStorage.set(name, value);
    }
  },
  removeItem: (name: string) => {
    fallbackAuthStorage.delete(name);
    const storage = getBrowserStorage();
    if (storage) {
      storage.removeItem(name);
    }
  },
};

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    return window.localStorage;
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") {
      return undefined;
    }
    throw error;
  }
}

interface User {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isAuthenticating: boolean;
  /** `beforeCommit` runs after the server accepts the credentials and before the app opens (used by the login animation). */
  login: (username: string, password: string, remember?: boolean, beforeCommit?: () => Promise<void>) => Promise<void>;
  register: (input: { username: string; mobile: string; password: string }, beforeCommit?: () => Promise<void>) => Promise<void>;
  logout: () => Promise<void>;
  setAuthenticating: (authenticating: boolean) => void;
  checkAuth: () => Promise<boolean>;
}

async function fetchWithAuth(path: string, init?: RequestInit) {
  const token = useAuthStore.getState().token;
  const baseUrl = await getApiBaseUrl();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // Ignore JSON parse errors, use status text
    }
    throw new Error(detail);
  }
  return res;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      isAuthenticating: false,

      login: async (username: string, password: string, remember = false, beforeCommit?: () => Promise<void>) => {
        set({ isAuthenticating: true });
        try {
          const baseUrl = await getApiBaseUrl();
          const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, remember }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail ?? res.statusText ?? "Login failed.");
          }
          const data = await res.json();
          if (beforeCommit) await beforeCommit();
          set({
            isAuthenticated: true,
            user: data.user,
            token: data.token,
            isAuthenticating: false,
          });
        } catch (error) {
          set({ isAuthenticating: false });
          throw error;
        }
      },

      register: async ({ username, mobile, password }, beforeCommit) => {
        set({ isAuthenticating: true });
        try {
          const baseUrl = await getApiBaseUrl();
          const res = await fetch(`${baseUrl}/api/auth/first-run-setup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, mobile, password }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
            throw new Error(detail ?? "Could not create the account.");
          }
          if (beforeCommit) await beforeCommit();
          set({ isAuthenticated: true, user: body.user, token: body.token, isAuthenticating: false });
        } catch (error) {
          set({ isAuthenticating: false });
          throw error;
        }
      },

      logout: async () => {
        const token = get().token;
        if (token) {
          try {
            await fetchWithAuth("/api/auth/logout", { method: "POST" });
          } catch {
            // Ignore logout errors, proceed with local cleanup
          }
        }
        set({
          isAuthenticated: false,
          user: null,
          token: null,
        });
      },

      setAuthenticating: (isAuthenticating: boolean) =>
        set({ isAuthenticating }),

      checkAuth: async () => {
        const token = get().token;
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return false;
        }
        try {
          const baseUrl = await getApiBaseUrl();
          const res = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error();
          const user = await res.json();
          set({ isAuthenticated: true, user });
          return true;
        } catch {
          set({ isAuthenticated: false, user: null, token: null });
          return false;
        }
      },
    }),
    {
      name: "sft-billing-auth",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
      storage: createJSONStorage(() => authStorage),
    },
  ),
);