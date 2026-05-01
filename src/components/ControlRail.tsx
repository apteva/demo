import { useState } from "react";
import type { DemoProfile } from "../lib/profiles.ts";

interface Props {
  profile: DemoProfile;
  profiles: Array<{ id: string; label: string }>;
  agentRunning: boolean;
  busy: boolean;
  onProfileChange: (id: string) => void;
  onSeed: () => void;
  onReset: () => void;
  onTrigger: (scenarioId: string) => void;
  onPauseToggle: () => void;
}

export function ControlRail({
  profile,
  profiles,
  agentRunning,
  busy,
  onProfileChange,
  onSeed,
  onReset,
  onTrigger,
  onPauseToggle,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <aside className="glass rounded-2xl p-4 w-72 shrink-0 self-start sticky top-4 space-y-4">
      <div>
        <label className="text-[11px] uppercase tracking-wide t-tertiary">Profile</label>
        <select
          value={profile.id}
          onChange={(e) => onProfileChange(e.target.value)}
          className="mt-1 w-full text-sm rounded-lg glass-inset px-2 py-1.5 t-primary"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide t-tertiary">Demo data</div>
        <button
          disabled={busy}
          onClick={onSeed}
          className="w-full h-9 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          ↻ Seed demo
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              setTimeout(() => setConfirmReset(false), 3000);
              return;
            }
            setConfirmReset(false);
            onReset();
          }}
          className={`w-full h-9 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
            confirmReset
              ? "bg-red text-white"
              : "border border-border t-primary hover:bg-surface-inset"
          }`}
        >
          {confirmReset ? "Click again to confirm" : "Find demo records (reset)"}
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide t-tertiary">Trigger scenarios</div>
        {profile.scenarios.map((s) => (
          <button
            key={s.id}
            disabled={busy}
            onClick={() => onTrigger(s.id)}
            className="w-full h-9 rounded-lg border border-border text-sm t-primary hover:bg-surface-inset disabled:opacity-40 text-left px-3 truncate"
            title={s.tagline}
          >
            ✉ {s.company}
          </button>
        ))}
        <p className="text-[10px] t-tertiary leading-snug">
          Sends a synthesized inbound-email message into the agent's
          stream. No real Outlook traffic.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide t-tertiary">Agent</div>
        <button
          onClick={onPauseToggle}
          disabled={busy}
          className="w-full h-9 rounded-lg border border-border text-sm t-primary hover:bg-surface-inset disabled:opacity-40"
        >
          {agentRunning ? "⏸ Pause agent" : "▶ Resume agent"}
        </button>
      </div>
    </aside>
  );
}
