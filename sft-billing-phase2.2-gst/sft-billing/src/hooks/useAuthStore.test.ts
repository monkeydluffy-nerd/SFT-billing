import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./useAuthStore";

vi.mock("@/services/backendPort", () => ({
  getApiBaseUrl: vi.fn().mockResolvedValue("http://127.0.0.1:8000"),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useAuthStore backend authentication", () => {
  beforeEach(() => {
    useAuthStore.persist.clearStorage();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      token: null,
      isAuthenticating: false,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("uses the API auth route and stores a successful login", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse({
        token: "session-token",
        user: {
          id: "user-1",
          username: "admin",
          is_admin: true,
          created_at: "2026-01-01T00:00:00Z",
          last_login_at: null,
        },
      }),
    );

    await useAuthStore.getState().login("admin", "correct-password");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username: "admin",
          password: "correct-password",
          remember: false,
        }),
      }),
    );
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      token: "session-token",
      user: { username: "admin" },
      isAuthenticating: false,
    });
  });

  it("waits for beforeCommit after the server accepts the login, and opens the app only afterwards", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        token: "session-token",
        user: { id: "user-1", username: "admin", is_admin: true, created_at: "2026-01-01T00:00:00Z", last_login_at: null },
      }),
    );
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen: boolean[] = [];

    const pending = useAuthStore.getState().login("admin", "correct-password", false, async () => {
      seen.push(useAuthStore.getState().isAuthenticated);
      await held;
    });
    await vi.waitFor(() => expect(seen).toEqual([false]));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    release();
    await pending;
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, token: "session-token" });
  });

  it("does not run beforeCommit when the backend rejects credentials", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ detail: "Invalid username or password" }, 401));
    const hook = vi.fn().mockResolvedValue(undefined);
    await expect(useAuthStore.getState().login("admin", "nope", false, hook)).rejects.toThrow();
    expect(hook).not.toHaveBeenCalled();
  });

  it("does not authenticate when the backend rejects credentials", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ detail: "Invalid username or password" }, 401),
    );

    await expect(
      useAuthStore.getState().login("admin", "wrong-password"),
    ).rejects.toThrow("Invalid username or password");
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      token: null,
      isAuthenticating: false,
    });
  });

  it("validates the stored session through the API auth route", async () => {
    useAuthStore.setState({ token: "session-token" });
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        id: "user-1",
        username: "admin",
        is_admin: true,
        created_at: "2026-01-01T00:00:00Z",
        last_login_at: null,
      }),
    );

    await expect(useAuthStore.getState().checkAuth()).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/auth/me",
      { headers: { Authorization: "Bearer session-token" } },
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("clears local auth state after requesting API logout", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      token: "session-token",
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: "ok" }));

    await useAuthStore.getState().logout();

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
    const requestHeaders = vi.mocked(fetch).mock.calls[0]?.[1]?.headers;
    expect(new Headers(requestHeaders).get("Authorization")).toBe(
      "Bearer session-token",
    );
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      token: null,
      user: null,
    });
  });
});
