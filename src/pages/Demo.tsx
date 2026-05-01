import { useEffect, useMemo, useState, useCallback } from "react";
import { ScenarioCard } from "../components/ScenarioCard.tsx";
import { ControlRail } from "../components/ControlRail.tsx";
import { ActivityStrip } from "../components/ActivityStrip.tsx";
import { ChatDock } from "../components/ChatDock.tsx";
import { SeedProgress } from "../components/SeedProgress.tsx";
import { defaultProfileId, getProfile, listProfiles } from "../lib/profiles.ts";
import { runRecipe, type StepProgress } from "../lib/recipe.ts";
import { listMCPServers } from "../api/mcp.ts";
import { getInstance, listInstances, sendEvent, startInstance, stopInstance } from "../api/instances.ts";
import type { Instance } from "../api/types.ts";

interface Props {
  instanceId: number | null;
  projectId: string | null;
}

/**
 * The one screen. Two columns: state board + recent activity on the
 * left, control rail on the right. Floating chat dock at bottom right.
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

  // Resolve the primary MCP server id for this profile (by slug).
  const [primaryMcpId, setPrimaryMcpId] = useState<number | null>(null);
  const [mcpStatus, setMcpStatus] = useState<string>("loading…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await listMCPServers();
        const target = all.find((s) => s.name === profile.primary_mcp.slug);
        if (cancelled) return;
        if (!target) {
          setPrimaryMcpId(null);
          setMcpStatus(`no MCP server named "${profile.primary_mcp.slug}"`);
        } else {
          setPrimaryMcpId(target.id);
          setMcpStatus(target.status);
        }
      } catch (e: any) {
        if (!cancelled) setMcpStatus("error");
      }
    })();
  }, [profile.primary_mcp.slug]);

  // Pulse logic — when a tool.call fires, briefly pulse the matching card.
  const [pulseId, setPulseId] = useState<string | null>(null);
  const onToolCall = useCallback((ev: any) => {
    const args = ev?.data?.args ?? {};
    const text = JSON.stringify(args);
    const hit = profile.scenarios.find((s) => text.includes(s.company.split(" ")[0]!));
    if (hit) {
      setPulseId(hit.id);
      setTimeout(() => setPulseId(null), 8000);
    }
  }, [profile.scenarios]);

  // ─── recipe runner UI state ───
  const [busy, setBusy] = useState(false);
  const [progressTitle, setProgressTitle] = useState("");
  const [progress, setProgress] = useState<StepProgress[]>([]);
  const [progressDone, setProgressDone] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);

  const runOne = useCallback(async (title: string, steps: any[]) => {
    if (!primaryMcpId) {
      alert("Primary MCP server not resolved — check that " + profile.primary_mcp.slug + " is connected.");
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
  }, [primaryMcpId, profile.primary_mcp.slug]);

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
    try {
      await sendEvent(instanceId, sc.trigger.message);
    } catch (e: any) {
      alert("Trigger failed: " + (e?.body ?? e?.message ?? String(e)));
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
      alert("Pause/resume failed: " + (e?.body ?? e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }, [instanceId, instance]);

  return (
    <div className="min-h-dvh px-4 py-4">
      <header className="max-w-7xl mx-auto mb-4 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold t-primary">{profile.label}</h1>
          <div className="text-xs t-tertiary flex gap-3 mt-0.5">
            <span>
              {instanceLoading
                ? "resolving instance…"
                : instance
                ? `Agent: ${instance.name} (${instance.status})`
                : "no agent bound"}
            </span>
            <span>·</span>
            <span>MCP: {profile.primary_mcp.slug} ({mcpStatus})</span>
            {primaryMcpId && <span>· id={primaryMcpId}</span>}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-4 items-start">
        <main className="flex-1 min-w-0 space-y-4">
          <section>
            <h2 className="text-[11px] uppercase tracking-wide t-tertiary mb-2">Customer state</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profile.scenarios.map((s) => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  serverId={primaryMcpId ?? 0}
                  pulse={pulseId === s.id}
                />
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-4">
            <h2 className="text-[11px] uppercase tracking-wide t-tertiary mb-2">Recent agent activity</h2>
            <ActivityStrip instanceId={instanceId} onToolCall={onToolCall} />
          </section>
        </main>

        <ControlRail
          profile={profile}
          profiles={profiles}
          agentRunning={instance?.status === "running"}
          busy={busy}
          onProfileChange={setProfileId}
          onSeed={onSeed}
          onReset={onReset}
          onTrigger={onTrigger}
          onPauseToggle={onPauseToggle}
        />
      </div>

      {progressOpen && (
        <SeedProgress
          title={progressTitle}
          progress={progress}
          done={progressDone}
          error={progressError}
          onClose={() => setProgressOpen(false)}
          onRetry={() => {
            setProgressOpen(false);
            // Re-run whatever was last triggered. Caller picks via the rail.
          }}
        />
      )}

      <ChatDock instanceId={instanceId} />
    </div>
  );
}
