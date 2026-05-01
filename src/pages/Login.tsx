import { useState } from "react";

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export function Login({ onLogin, error, loading }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <form
        onSubmit={(e) => { e.preventDefault(); onLogin(email.trim(), password); }}
        className="glass rounded-2xl p-6 w-full max-w-sm space-y-4 fade-up"
      >
        <div>
          <h1 className="text-lg font-semibold t-primary">Apteva</h1>
          <p className="text-sm t-secondary mt-0.5">Sign in to watch your agents.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium t-secondary">Email or username</span>
          <input
            type="text"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg glass-inset px-3 py-2 text-sm t-primary focus:outline-none"
            placeholder="you@company.com or username"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium t-secondary">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg glass-inset px-3 py-2 text-sm t-primary focus:outline-none"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <div className="text-xs text-red bg-red-light rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full h-9 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-[11px] t-tertiary text-center">
          Read-only view · your agent's work, live.
        </p>
      </form>
    </div>
  );
}
