// ControlRail — the demo's agent-side rail.
//
// Holds everything that's about THE AGENT (its current state, what
// it's doing right now, knobs the operator turns) — distinct from the
// right-hand integration view which shows the customer system being
// changed by the agent. Sticky, scrolls independently, single column.
//
// Sections (top to bottom):
// - Agent state — running/paused, instance name, MCP backend, pause control
// - Agent activity — live telemetry (tool calls, threads) via ActivityStrip
// - Trigger scenarios — one-click"send synthesised email" buttons
// - Demo data — seed / find-records actions
//
// Profile selection has moved into the page header (more discoverable
// than buried at the top of the rail) so the rail focuses on running
// the demo, not configuring it.

import { useState } from "react";
import { Mail, Pause, Play, RefreshCw, RotateCcw } from "lucide-react";
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
 ? "bg-success"
 : agentStatus === "stopped" || agentStatus === "paused"
 ? "bg-warn"
 : "bg-zinc-500";

 return (
 <aside className="w-[340px] shrink-0 self-start sticky top-4 space-y-4">
 <RailSection title="Agent state">
 <div className="flex items-center gap-2">
 <span
 className={`relative w-2 h-2 rounded-full ${statusDot} ${
 agentRunning ? "status-pulse status-pulse-green" :""
 }`}
 />
 <div className="min-w-0 flex-1">
 <div className="text-sm font-medium text-text truncate">
 {agentName ?? "no agent bound"}
 </div>
 <div className="text-xs text-text-dim truncate">
 {agentStatus} · MCP {mcpStatus}
 </div>
 </div>
 </div>
 <button
 onClick={onPauseToggle}
 disabled={busy || !instanceId}
 className="w-full h-9 rounded-lg border border-border text-sm text-text hover:bg-bg-hover disabled:opacity-40 transition-colors"
 >
 <span className="inline-flex items-center gap-1.5">{agentRunning ? <><Pause className="w-3.5 h-3.5" />Pause agent</> : <><Play className="w-3.5 h-3.5" />Resume agent</>}</span>
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
 className="w-full h-9 rounded-lg border border-border text-sm text-text hover:bg-bg-hover hover:border-accent/40 disabled:opacity-40 disabled:hover:border-border text-left px-3 truncate transition-colors"
 title={s.tagline}
 >
 <Mail className="w-3.5 h-3.5 text-text-dim inline-block mr-1.5" />
 {s.company}
 </button>
 ))}
 </div>
 <p className="text-[11px] text-text-dim leading-snug pt-0.5">
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
 <span className="inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Seed demo</span>
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
 ? "bg-error text-white"
 : "border border-border text-text hover:bg-bg-hover"
 }`}
 >
 {confirmReset ? "Click again to confirm" :"Find demo records (reset)"}
 </button>
 </RailSection>
 </aside>
 );
}

// RailSection — small reusable bg-bg-card border border-border shadow-card card with a label header. Keeps
// the rail visually consistent across sections without sprinkling
// utility classes everywhere.
function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
 return (
 <div className="bg-bg-card border border-border shadow-card rounded-xl p-3 space-y-2.5">
 <div className="text-[11px] uppercase tracking-wider text-text-dim font-medium">
 {title}
 </div>
 {children}
 </div>
 );
}
