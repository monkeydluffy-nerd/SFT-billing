import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getBackendPort,
  getApiBaseUrl,
  initializeBackendConnection,
  clearBackendPortCache,
  isBackendPortInitialized,
  getBackendInitializationError,
  checkBackendHealth,
  discoverBackendPort,
} from "./backendPort";

interface TauriWindow extends Window {
  __TAURI__?: { invoke: (command: string, args?: unknown) => Promise<unknown> };
  __SFT_BILLING_BACKEND_PORT__?: number;
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("backendPort", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    clearBackendPortCache();

    vi.unstubAllEnvs();
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8000");
  });

  afterEach(() => {
    clearBackendPortCache();
    const tauriWindow = window as TauriWindow;
    delete tauriWindow.__TAURI__;
    delete tauriWindow.__SFT_BILLING_BACKEND_PORT__;
    vi.unstubAllEnvs();
  });

  describe("getBackendPort", () => {
    it("returns default port 8000 when no Tauri or env config", async () => {
      // No window.__TAURI__, no meta tag, no global variable
      const port = await getBackendPort();
      expect(port).toBe(8000);
    });

    it("caches the port after first call", async () => {
      const port1 = await getBackendPort();
      const port2 = await getBackendPort();
      expect(port1).toBe(port2);
      expect(port1).toBe(8000);
    });

    it("uses VITE_API_BASE_URL port in development", async () => {
      vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8005");
      vi.resetModules();
      clearBackendPortCache();
      
      const { getBackendPort: getBackendPortFresh } = await import("./backendPort");
      const port = await getBackendPortFresh();
      expect(port).toBe(8005);
    });

    it("uses meta tag port when available", async () => {
      const meta = document.createElement('meta');
      meta.name = 'sft-billing-backend-port';
      meta.content = '8003';
      document.head.appendChild(meta);
      
      vi.resetModules();
      clearBackendPortCache();
      const { getBackendPort: getBackendPortFresh } = await import("./backendPort");
      const port = await getBackendPortFresh();
      
      document.head.removeChild(meta);
      expect(port).toBe(8003);
    });

    it("uses global variable port when available", async () => {
      const tauriWindow = window as TauriWindow;
      tauriWindow.__SFT_BILLING_BACKEND_PORT__ = 8004;
      
      vi.resetModules();
      clearBackendPortCache();
      const { getBackendPort: getBackendPortFresh } = await import("./backendPort");
      const port = await getBackendPortFresh();
      
      delete tauriWindow.__SFT_BILLING_BACKEND_PORT__;
      expect(port).toBe(8004);
    });

    it("prefers Tauri invoke over other methods", async () => {
      // Set up Tauri mock
      const tauriWindow = window as TauriWindow;
      tauriWindow.__TAURI__ = {
        invoke: vi.fn().mockResolvedValue(8007),
      };
      
      vi.resetModules();
      clearBackendPortCache();
      const { getBackendPort: getBackendPortFresh } = await import("./backendPort");
      const port = await getBackendPortFresh();
      
      delete tauriWindow.__TAURI__;
      expect(port).toBe(8007);
    });

    it("does not use a development fallback in a production build", async () => {
      vi.stubEnv("DEV", false);
      vi.stubEnv("PROD", true);

      vi.resetModules();
      clearBackendPortCache();
      const { getBackendPort: getBackendPortFresh } = await import("./backendPort");

      await expect(getBackendPortFresh()).rejects.toThrow(
        "Tauri backend port command is unavailable in the production app.",
      );
    });

    it("does not fall back when the Tauri backend-port command fails", async () => {
      const tauriWindow = window as TauriWindow;
      tauriWindow.__TAURI__ = {
        invoke: vi.fn().mockRejectedValue(new Error("Tauri command unavailable")),
      };

      vi.resetModules();
      clearBackendPortCache();
      const { getBackendPort: getBackendPortFresh } = await import("./backendPort");

      await expect(getBackendPortFresh()).rejects.toThrow("Tauri command unavailable");
      delete tauriWindow.__TAURI__;
    });
  });

  describe("getApiBaseUrl", () => {
    it("constructs correct URL from port", async () => {
      const url = await getApiBaseUrl();
      expect(url).toBe("http://127.0.0.1:8000");
    });
  });

  describe("checkBackendHealth", () => {
    it("returns true for healthy backend", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });

      const healthy = await checkBackendHealth(8000);
      expect(healthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/health", {
        method: "GET",
        signal: expect.any(AbortSignal),
      });
    });

    it("returns false for unhealthy backend", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "error" }),
      });

      const healthy = await checkBackendHealth(8000);
      expect(healthy).toBe(false);
    });

    it("returns false when fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const healthy = await checkBackendHealth(8000);
      expect(healthy).toBe(false);
    });

    it("returns false for non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const healthy = await checkBackendHealth(8000);
      expect(healthy).toBe(false);
    });
  });

  describe("initializeBackendConnection", () => {
    it("resolves base URL when backend is healthy", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });

      const baseUrl = await initializeBackendConnection(3, 10);
      expect(baseUrl).toBe("http://127.0.0.1:8000");
    });

    it("retries on failure and succeeds", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Not ready"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "ok" }),
        });

      const baseUrl = await initializeBackendConnection(3, 10);
      expect(baseUrl).toBe("http://127.0.0.1:8000");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws error when backend never becomes healthy", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      await expect(initializeBackendConnection(2, 10)).rejects.toThrow("Backend not ready");
    });

    it("includes port in error message", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      try {
        await initializeBackendConnection(2, 10);
      } catch (error) {
        expect((error as Error).message).toContain("8000");
      }
    });
  });

  describe("clearBackendPortCache", () => {
    it("resets cached port", async () => {
      await getBackendPort(); // Initialize cache
      expect(isBackendPortInitialized()).toBe(true);
      
      clearBackendPortCache();
      expect(isBackendPortInitialized()).toBe(false);
    });

    it("allows re-resolution after clear", async () => {
      await getBackendPort();
      clearBackendPortCache();
      
      vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8009");
      vi.resetModules();
      
      const { getBackendPort: getBackendPortFresh } = await import("./backendPort");
      const port = await getBackendPortFresh();
      expect(port).toBe(8009);
    });
  });

  describe("isBackendPortInitialized", () => {
    it("returns false before initialization", () => {
      expect(isBackendPortInitialized()).toBe(false);
    });

    it("returns true after successful initialization", async () => {
      await getBackendPort();
      expect(isBackendPortInitialized()).toBe(true);
    });

    it("returns false after clear", async () => {
      await getBackendPort();
      clearBackendPortCache();
      expect(isBackendPortInitialized()).toBe(false);
    });
  });

  describe("getBackendInitializationError", () => {
    it("returns null before initialization", () => {
      expect(getBackendInitializationError()).toBeNull();
    });

    it("returns error after failed initialization", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));
      
      try {
        await initializeBackendConnection(1, 10);
      } catch {
        // Expected to throw
      }
      
      const error = getBackendInitializationError();
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("Backend not ready");
    });
  });

  describe("discoverBackendPort", () => {
    it("finds first healthy port in range", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false }) // 8000
        .mockResolvedValueOnce({ ok: false }) // 8001
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: "ok" }) }); // 8002

      const port = await discoverBackendPort(8000, 8005);
      expect(port).toBe(8002);
    });

    it("throws when no healthy port found", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(discoverBackendPort(8000, 8002)).rejects.toThrow("No backend found in port range 8000-8002");
    });
  });
});

describe("backendPort - test mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    clearBackendPortCache();

    vi.unstubAllEnvs();
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8000");
  });

  afterEach(() => {
    clearBackendPortCache();
    vi.unstubAllEnvs();
  });

  it("uses VITE_API_BASE_URL directly in test mode without initialization", async () => {
    const { getBackendPort: getBackendPortTest } = await import("./backendPort");
    const port = await getBackendPortTest();
    expect(port).toBe(8000);
  });

  it("does not call fetch in test mode", async () => {
    await import("./backendPort");
    
    // In test mode, initialization should not be attempted
    // The base URL should come directly from env
    const { getApiBaseUrl: getApiBaseUrlTest } = await import("./backendPort");
    const url = await getApiBaseUrlTest();
    expect(url).toBe("http://127.0.0.1:8000");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});