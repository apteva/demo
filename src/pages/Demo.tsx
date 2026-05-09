import { useEffect, useMemo, useState, useCallback } from "react";
import { ControlRail } from "../components/ControlRail.tsx";
import { ChatDock } from "../components/ChatDock.tsx";
import { SeedProgress } from "../components/SeedProgress.tsx";
import { IntegrationCard } from "../components/IntegrationCard.tsx";
import { defaultProfileId, getProfile, listProfiles } from "../lib/profiles.ts";
import { runRecipe, type StepProgress } from "../lib/recipe.ts";
import { listMCPServers } from "../api/mcp.ts";
import { getInstance, listInstances, sendEvent, startInstance, stopInstance } from "../api/instances.ts";
import type { Instance } from "../api/types.ts";

interface Props {
 instanceId: number | null;
 projectId: string | null;
}

const SEVERITY_BAR: Record<"red" |"amber" |"green", string> = {
 red: "bg-error",
 amber: "bg-warn",
 green: "bg-success",
};

/**
 * The one screen.
 *
 * Two zones, side-by-side:
 * - Left rail (340px): the AGENT — its state, live activity, the
 * scripted-scenario triggers, and seed/reset.
 * - Right column (fluid): the INTEGRATION VIEW — pipeline strip,
 * customer-state cards, recent CRM activity. Each major block is
 * a bg-bg-card border border-border shadow-card card so the visual rhythm is consistent.
 *
 * Header carries title, profile picker, and a one-line status string.
 * Floating chat dock pinned bottom-right by ChatDock itself.
 */
export function Demo({ instanceId: forcedInstanceId, projectId }: Props) {
 const [profileId, setProfileId] = useState<string>(() => defaultProfileId());
 const profile = useMemo(() => getProfile(profileId)!, [profileId]);
 const profiles = useMemo(() => listProfiles(), []);

 // Resolve the bound instance: explicit ?instance= wins, else
 // pick the instance whose name matches profile.instance_binding,
 // else null (chat + activity strip simply stay quiet).
 const [instance, setInstance] = useState<Instance | null>(null);
 const [instanceLoading, setInstanceLoading] = useState(true);
 const instanceId = instance?.id ?? null;

 useEffect(() => {
 let cancelled = false;
 setInstanceLoading(true);
 (async () => {
 try {
 if (forcedInstanceId) {
 const inst = await getInstance(forcedInstanceId);
 if (!cancelled) setInstance(inst);
 } else {
 const all = await listInstances(projectId ?? undefined);
 const target = profile.instance_binding?.kind === "by_name"
 ? all.find((i) => i.name === profile.instance_binding!.name) ?? null
 : all[0] ?? null;
 if (!cancelled) setInstance(target);
 }
 } catch {
 if (!cancelled) setInstance(null);
 } finally {
 if (!cancelled) setInstanceLoading(false);
 }
 })();
 return () => { cancelled = true; };
 }, [forcedInstanceId, projectId, profile.instance_binding?.kind, profile.instance_binding?.name]);

 // Resolve the primary MCP server id for this profile (by app slug).
 const [primaryMcpId, setPrimaryMcpId] = useState<number | null>(null);
 const [mcpStatus, setMcpStatus] = useState<string>("loading…");

 useEffect(() => {
 let cancelled = false;
 (async () => {
 try {
 const all = await listMCPServers();
 const target = all.find((s) => s.name === profile.primary_app);
 if (cancelled) return;
 if (!target) {
 setPrimaryMcpId(null);
 setMcpStatus(`no"${profile.primary_app}" server`);
 } else {
 setPrimaryMcpId(target.id);
 setMcpStatus(target.status);
 }
 } catch {
 if (!cancelled) setMcpStatus("error");
 }
 })();
 }, [profile.primary_app]);

 const [pulseId, setPulseId] = useState<string | null>(null);

 // ─── recipe runner UI state ───
 const [busy, setBusy] = useState(false);
 const [progressTitle, setProgressTitle] = useState("");
 const [progress, setProgress] = useState<StepProgress[]>([]);
 const [progressDone, setProgressDone] = useState(false);
 const [progressError, setProgressError] = useState<string | null>(null);
 const [progressOpen, setProgressOpen] = useState(false);

 const runOne = useCallback(async (title: string, steps: any[]) => {
 if (!primaryMcpId) {
 alert("Primary MCP server not resolved — check that" + profile.primary_app +" is connected.");
 return;
 }
 setBusy(true);
 setProgressTitle(title);
 setProgress(steps.map((s, i) => ({ index: i, step: s, status: "pending" as const })));
 setProgressDone(false);
 setProgressError(null);
 setProgressOpen(true);
 try {
 await runRecipe(steps, primaryMcpId, {}, (p) => {
 setProgress((prev) => prev.map((x, i) => (i === p.index ? p : x)));
 });
 } catch (e: any) {
 setProgressError(String(e?.message ?? e));
 } finally {
 setProgressDone(true);
 setBusy(false);
 }
 }, [primaryMcpId, profile.primary_app]);

 const onSeed = useCallback(() => runOne("Seeding demo data…", profile.seed.steps), [profile.seed.steps, runOne]);
 const onReset = useCallback(() => runOne("Finding demo records…", profile.reset.steps), [profile.reset.steps, runOne]);

 const onTrigger = useCallback(async (scenarioId: string) => {
 if (!instanceId) {
 alert("No agent bound — set ?instance=N or pick one matching the profile.");
 return;
 }
 const sc = profile.scenarios.find((s) => s.id === scenarioId);
 if (!sc) return;
 setBusy(true);
 setPulseId(scenarioId);
 setTimeout(() => setPulseId(null), 8000);
 try {
 await sendEvent(instanceId, sc.trigger.message);
 } catch (e: any) {
 alert("Trigger failed:" + (e?.body ?? e?.message ?? String(e)));
 } finally {
 setBusy(false);
 }
 }, [instanceId, profile.scenarios]);

 const onPauseToggle = useCallback(async () => {
 if (!instanceId || !instance) return;
 setBusy(true);
 try {
 if (instance.status === "running") {
 await stopInstance(instanceId);
 setInstance({ ...instance, status: "stopped" });
 } else {
 await startInstance(instanceId);
 setInstance({ ...instance, status: "running" });
 }
 } catch (e: any) {
 alert("Pause/resume failed:" + (e?.body ?? e?.message ?? String(e)));
 } finally {
 setBusy(false);
 }
 }, [instanceId, instance]);

 const layout = profile.layout;
 const headerLabel = profile.branding?.header_label ?? profile.label;
 const ctxProps = profile.context_props;

 const agentStatus =
 instanceLoading ? "loading"
 : !instance ? "not bound"
 : instance.status;

 return (
 <div className="min-h-dvh px-4 py-4">
 {/* ── Header ── */}
 <header className="max-w-7xl mx-auto mb-4">
 <div className="bg-bg-card border border-border shadow-card rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
 <div className="flex-1 min-w-0">
 <h1 className="text-base font-semibold text-text truncate">{headerLabel}</h1>
 <div className="text-xs text-text-dim truncate flex items-center gap-2">
 <span className={`w-1.5 h-1.5 rounded-full ${
 instance?.status === "running" ? "bg-success"
 : instance ? "bg-warn"
 : "bg-zinc-500"
 }`} />
 <span>
 {instanceLoading ? "resolving…"
 : instance ? `${instance.name} · ${instance.status}`
 : "no agent bound"}
 </span>
 <span>·</span>
 <span>{profile.primary_app}: {mcpStatus}</span>
 </div>
 </div>
 {profiles.length > 1 && (
 <div className="flex items-center gap-2">
 <label className="text-[11px] uppercase tracking-wider text-text-dim">Profile</label>
 <select
 value={profile.id}
 onChange={(e) => setProfileId(e.target.value)}
 className="text-sm rounded-lg bg-bg-hover border border-border px-2 py-1.5 text-text border border-border"
 >
 {profiles.map((p) => (
 <option key={p.id} value={p.id}>{p.label}</option>
 ))}
 </select>
 </div>
 )}
 </div>
 </header>

 {/* ── Two-zone body ── */}
 <div className="max-w-7xl mx-auto flex gap-4 items-start">
 <ControlRail
 profile={profile}
 agentRunning={instance?.status === "running"}
 agentName={instance?.name ?? null}
 agentStatus={agentStatus}
 mcpStatus={mcpStatus}
 instanceId={instanceId}
 busy={busy}
 onSeed={onSeed}
 onReset={onReset}
 onTrigger={onTrigger}
 onPauseToggle={onPauseToggle}
 />

 <main className="flex-1 min-w-0 space-y-4">
 {/* Top-level integration tiles render as their own cards
 (PipelineStrip, ActivityFeed wrap in @apteva/ui-kit's
 Card with their own CardHeader). No outer wrapper —
 would just nest a card inside a card with duplicate
 titles. */}
 {layout.header_tile && (
 <IntegrationCard
 spec={layout.header_tile}
 appSlug={profile.primary_app}
 serverId={primaryMcpId}
 contextProps={ctxProps}
 />
 )}

 {/* Customer-state groups DO get an outer panel because each
 group contains multiple inner cards (a deal + a ticket +
 a contact). The wrapper is a"scenario" container with a
 title + severity dot + tagline — that's content the
 individual cards can't carry. */}
 <section>
 <h2 className="text-[11px] uppercase tracking-wider text-text-dim font-medium mb-1.5 px-1">
 Customer state
 </h2>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 {layout.customer_state.map((group) => (
 <div
 key={group.id}
 className={`relative rounded-xl p-3 bg-bg-card border border-border shadow-card space-y-2 transition-shadow ${
 pulseId === group.id ? "ring-2 ring-accent/60" :""
 }`}
 >
 <div className="flex items-center gap-2">
 {group.severity && (
 <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_BAR[group.severity]} shrink-0`} />
 )}
 <h3 className="text-sm font-semibold text-text truncate">{group.title}</h3>
 </div>
 {group.tagline && (
 <p className="text-xs text-text-dim leading-snug">{group.tagline}</p>
 )}
 <div className="flex flex-col gap-2 pt-1">
 {group.tiles.map((tile, i) => (
 <IntegrationCard
 key={i}
 spec={tile}
 appSlug={profile.primary_app}
 serverId={primaryMcpId}
 contextProps={ctxProps}
 />
 ))}
 </div>
 </div>
 ))}
 </div>
 </section>

 {layout.activity && (
 <IntegrationCard
 spec={layout.activity}
 appSlug={profile.primary_app}
 serverId={primaryMcpId}
 contextProps={ctxProps}
 />
 )}
 </main>
 </div>

 {progressOpen && (
 <SeedProgress
 title={progressTitle}
 progress={progress}
 done={progressDone}
 error={progressError}
 onClose={() => setProgressOpen(false)}
 onRetry={() => setProgressOpen(false)}
 />
 )}

 <ChatDock instanceId={instanceId} />
 </div>
 );
}

