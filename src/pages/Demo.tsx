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

const SEVERITY_BAR: Record<"red" | "amber" | "green", string> = {
  red:   "bg-red",
  amber: "bg-orange",
  green: "bg-green",
};

/**
 * The one screen. Header tile across the top, customer-state grid +
 * activity strip on the left, control rail on the right. Everything
 * below the header is rendered generically from the profile's
 * `layout` block via IntegrationCard.
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
          setMcpStatus(`no MCP server named "${profile.primary_app}"`);
        } else {
          setPrimaryMcpId(target.id);
          setMcpStatus(target.status);
        }
      } catch {
        if (!cancelled) setMcpStatus("error");
      }
    })();
  }, [profile.primary_app]);

  // Pulse logic — when a scenario is triggered, briefly pulse the
  // matching group. (We also pulse on agent tool-call events; that
  // wiring re-enables once ActivityStrip is restored as a tile.)
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
      alert("Primary MCP server not resolved — check that " + profile.primary_app + " is connected.");
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

  const layout = profile.layout;
  const headerLabel = profile.branding?.header_label ?? profile.label;
  const ctxProps = profile.context_props;

  return (
    <div className="min-h-dvh px-4 py-4">
      <header className="max-w-7xl mx-auto mb-4 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold t-primary">{headerLabel}</h1>
          <div className="text-xs t-tertiary flex gap-3 mt-0.5">
            <span>
              {instanceLoading
                ? "resolving instance…"
                : instance
                ? `Agent: ${instance.name} (${instance.status})`
                : "no agent bound"}
            </span>
            <span>·</span>
            <span>App: {profile.primary_app} ({mcpStatus})</span>
            {primaryMcpId && <span>· id={primaryMcpId}</span>}
          </div>
        </div>
      </header>

      {layout.header_tile && (
        <div className="max-w-7xl mx-auto mb-4">
          <IntegrationCard
            spec={layout.header_tile}
            appSlug={profile.primary_app}
            serverId={primaryMcpId}
            contextProps={ctxProps}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto flex gap-4 items-start">
        <main className="flex-1 min-w-0 space-y-4">
          <section>
            <h2 className="text-[11px] uppercase tracking-wide t-tertiary mb-2">Customer state</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {layout.customer_state.map((group) => (
                <div
                  key={group.id}
                  className={`relative rounded-lg p-3 glass space-y-2 ${pulseId === group.id ? "ring-2 ring-accent/60" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {group.severity && (
                      <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_BAR[group.severity]}`} />
                    )}
                    <h3 className="text-sm font-semibold t-primary truncate">{group.title}</h3>
                  </div>
                  {group.tagline && (
                    <p className="text-[11px] t-tertiary leading-snug">{group.tagline}</p>
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
            <section>
              <h2 className="text-[11px] uppercase tracking-wide t-tertiary mb-2">Recent activity</h2>
              <IntegrationCard
                spec={layout.activity}
                appSlug={profile.primary_app}
                serverId={primaryMcpId}
                contextProps={ctxProps}
              />
            </section>
          )}
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
          }}
        />
      )}

      <ChatDock instanceId={instanceId} />
    </div>
  );
}
