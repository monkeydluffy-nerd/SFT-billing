import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

interface AuthState {
  isAuthenticated: boolean;
  user: { username: string } | null;
  login: (username: string) => void;
  logout: () => void;
  setAuthenticating: (authenticating: boolean) => void;
  isAuthenticating: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      isAuthenticating: false,
      login: (username: string) =>
        set({
          isAuthenticated: true,
          user: { username },
          isAuthenticating: false,
        }),
      logout: () =>
        set({
          isAuthenticated: false,
          user: null,
          isAuthenticating: false,
        }),
      setAuthenticating: (isAuthenticating: boolean) =>
        set({ isAuthenticating }),
    }),
    {
      name: "sft-billing-auth",
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, user: state.user }),
      storage: createJSONStorage(() => authStorage),
    },
  ),
);