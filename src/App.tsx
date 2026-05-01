import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth.ts";
import { Login } from "./pages/Login.tsx";
import { Demo } from "./pages/Demo.tsx";

declare const __DEFAULT_PROJECT__: string | undefined;

function paramInt(name: string): number | null {
  const v = new URLSearchParams(window.location.search).get(name);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function paramStr(name: string): string | null {
  const v = new URLSearchParams(window.location.search).get(name);
  return v && v.length > 0 ? v : null;
}

export function App() {
  const [dark, setDark] = useState(false);
  const auth = useAuth();

  useEffect(() => { document.body.classList.toggle("dark", dark); }, [dark]);

  const initialInstance = useMemo(() => paramInt("instance"), []);
  const initialProject = useMemo(() => {
    const fromUrl = paramStr("project");
    if (fromUrl) return fromUrl;
    if (typeof window !== "undefined") {
      const w = (window as any).__DEFAULT_PROJECT__;
      if (typeof w === "string" && w) return w;
    }
    if (typeof __DEFAULT_PROJECT__ !== "undefined" && __DEFAULT_PROJECT__) {
      return __DEFAULT_PROJECT__;
    }
    return null;
  }, []);

  if (auth.loading) {
    return <div className="min-h-dvh grid place-items-center t-tertiary text-sm">Loading…</div>;
  }
  if (!auth.user) {
    return <Login onLogin={auth.login} error={auth.error} loading={auth.loading} />;
  }

  return (
    <>
      <Demo instanceId={initialInstance} projectId={initialProject} />
      <button
        onClick={() => setDark((d) => !d)}
        className="fixed bottom-4 left-4 z-30 h-9 px-3 rounded-full glass text-xs t-secondary hover:t-primary"
        title="Toggle dark mode"
      >
        {dark ? "☀" : "☾"}
      </button>
      {!auth.kiosk && (
        <button
          onClick={auth.logout}
          className="fixed top-4 right-4 z-30 text-[11px] t-tertiary hover:t-primary"
        >
          Sign out
        </button>
      )}
    </>
  );
}
