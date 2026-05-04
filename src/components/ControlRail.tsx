// ControlRail — the demo's agent-side rail.
//
// Holds everything that's about THE AGENT (its current state, what
// it's doing right now, knobs the operator turns) — distinct from the
// right-hand integration view which shows the customer system being
// changed by the agent. Sticky, scrolls independently, single column.
//
// Sections (top to bottom):
//   - Agent state — running/paused, instance name, MCP backend, pause control
//   - Agent activity — live telemetry (tool calls, threads) via ActivityStrip
//   - Trigger scenarios — one-click "send synthesised email" buttons
//   - Demo data — seed / find-records actions
//
// Profile selection has moved into the page header (more discoverable
// than buried at the top of the rail) so the rail focuses on running
// the demo, not configuring it.

import { useState } from "react";
import type { DemoProfile } from "../lib/profiles.ts";
import { ActivityStrip } from "./ActivityStrip.tsx";

interface Props {
  profile: DemoProfile;
  agentRunning: boolean;
  agentName: string | null;
  agentStatus: string;
  mcpStatus: string;
  instanceId: number | null;
  busy: boolean;
  onSeed: () => void;
  onReset: () => void;
  onTrigger: (scenarioId: string) => void;
  onPauseToggle: () => void;
}

export function ControlRail({
  profile,
  agentRunning,
  agentName,
  agentStatus,
  mcpStatus,
  instanceId,
  busy,
  onSeed,
  onReset,
  onTrigger,
  onPauseToggle,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  const statusDot =
    agentStatus === "running"
      ? "bg-green"
      : agentStatus === "stopped" || agentStatus === "paused"
      ? "bg-orange"
      : "bg-text-dim";

  return (
    <aside className="w-[340px] shrink-0 self-start sticky top-4 space-y-4">
      <RailSection title="Agent state">
        <div className="flex items-center gap-2">
          <span
            className={`relative w-2 h-2 rounded-full ${statusDot} ${
              agentRunning ? "status-pulse status-pulse-green" : ""
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium t-primary truncate">
              {agentName ?? "no agent bound"}
            </div>
            <div className="text-[11px] t-tertiary truncate">
              {agentStatus} · MCP {mcpStatus}
            </div>
          </div>
        </div>
        <button
          onClick={onPauseToggle}
          disabled={busy || !instanceId}
          className="w-full h-9 rounded-lg border border-border text-sm t-primary hover:bg-bg-input disabled:opacity-40 transition-colors"
        >
          {agentRunning ? "⏸ Pause agent" : "▶ Resume agent"}
        </button>
      </RailSection>

      <RailSection title="Agent activity">
        <ActivityStrip instanceId={instanceId} />
      </RailSection>

      <RailSection title="Trigger scenarios">
        <div className="space-y-1.5">
          {profile.scenarios.map((s) => (
            <button
              key={s.id}
              disabled={busy || !instanceId}
              onClick={() => onTrigger(s.id)}
              className="w-full h-9 rounded-lg border border-border text-sm t-primary hover:bg-bg-input hover:border-accent/40 disabled:opacity-40 disabled:hover:border-border text-left px-3 truncate transition-colors"
              title={s.tagline}
            >
              <span className="t-tertiary mr-1.5">✉</span>
              {s.company}
            </button>
          ))}
        </div>
        <p className="text-[10px] t-tertiary leading-snug pt-0.5">
          Sends a synthesised inbound-email message into the agent's stream.
          No real Outlook traffic.
        </p>
      </RailSection>

      <RailSection title="Demo data">
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
              : "border border-border t-primary hover:bg-bg-input"
          }`}
        >
          {confirmReset ? "Click again to confirm" : "Find demo records (reset)"}
        </button>
      </RailSection>
    </aside>
  );
}

// RailSection — small reusable glass card with a label header. Keeps
// the rail visually consistent across sections without sprinkling
// utility classes everywhere.
function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-3 space-y-2.5">
      <div className="text-[10px] uppercase tracking-wider t-tertiary font-medium">
        {title}
      </div>
      {children}
    </div>
  );
}
