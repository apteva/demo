import { useCallback, useEffect, useState } from "react";
import * as authApi from "../api/auth.ts";
import { setApiKey, setUnauthorizedHandler } from "../api/client.ts";
import type { User } from "../api/types.ts";

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  // true when auth uses an API key (kiosk/embedded mode) instead of a session cookie
  kiosk: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null, kiosk: false });

  useEffect(() => {
    // Kiosk-key precedence: URL ?api_key=... beats install config so a
    // shareable link can override the per-install default. The
    // install-level fallback comes from window.__APTEVA_APP__.kiosk_api_key,
    // which apteva-server injects into index.html (see apps_static.go).
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get("api_key");
    const installed = (window as any).__APTEVA_APP__;
    const installedKey = installed && typeof installed.kiosk_api_key === "string"
      ? installed.kiosk_api_key
      : "";
    const key = urlKey || installedKey;
    if (key) {
      setApiKey(key);
      setState({ user: { user_id: 0 }, loading: false, error: null, kiosk: true });
      return;
    }

    // Otherwise probe the session cookie.
    setUnauthorizedHandler(() => {
      setState((s) => ({ ...s, user: null }));
    });
    authApi.me()
      .then((u) => setState({ user: u, loading: false, error: null, kiosk: false }))
      .catch(() => setState({ user: null, loading: false, error: null, kiosk: false }));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const user = await authApi.login(email, password);
      setState({ user, loading: false, error: null, kiosk: false });
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err?.body || "invalid credentials" }));
    }
  }, []);

  const logout = useCallback(async () => {
    if (state.kiosk) return;
    try { await authApi.logout(); } catch {}
    setState({ user: null, loading: false, error: null, kiosk: false });
  }, [state.kiosk]);

  return { ...state, login, logout };
}
