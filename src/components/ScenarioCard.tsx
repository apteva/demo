import { useEffect, useState } from "react";
import { callToolJSON } from "../api/mcp.ts";
import { selectFromResult } from "../lib/recipe.ts";
import type { Scenario } from "../lib/profiles.ts";

interface Props {
  scenario: Scenario;
  serverId: number;
  pulse?: boolean;          // briefly highlight when the agent acts
}

const SEVERITY_TINT: Record<Scenario["severity"], string> = {
  red:   "border-red bg-red-light",
  amber: "border-orange bg-orange-light",
  green: "border-green bg-green-light",
};

const SEVERITY_DOT: Record<Scenario["severity"], string> = {
  red:   "bg-red",
  amber: "bg-orange",
  green: "bg-green",
};

/**
 * Polls the scenario's live_query every 5s and renders the configured
 * fields. Designed to be at-most-eventually-consistent — failures are
 * tolerated and the previous good snapshot stays on screen.
 */
export function ScenarioCard({ scenario, serverId, pulse }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    async function poll() {
      const res = await callToolJSON<any>(serverId, scenario.live_query.tool, scenario.live_query.args);
      if (cancelled) return;
      if (res.ok) {
        setData(res.data);
        setErr(null);
      } else {
        setErr(res.error);
      }
      setLoading(false);
      timer = setTimeout(poll, 5000);
    }
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [scenario.id, serverId]);

  const headline = data ? selectFromResult(data, scenario.render.headline) : null;
  const detail   = data && scenario.render.detail   ? selectFromResult(data, scenario.render.detail)   : null;
  const badgeCount = data && scenario.render.badge_count ? selectFromResult(data, scenario.render.badge_count) : null;

  return (
    <div
      className={[
        "glass rounded-2xl p-4 border-l-4 transition-all",
        SEVERITY_TINT[scenario.severity],
        pulse ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${SEVERITY_DOT[scenario.severity]}`} />
            <h3 className="font-semibold t-primary text-sm truncate">{scenario.company}</h3>
          </div>
          <p className="text-xs t-secondary mt-1 leading-snug">{scenario.tagline}</p>
        </div>
        {badgeCount !== null && badgeCount !== undefined && (
          <span className="text-[10px] t-tertiary shrink-0">{String(badgeCount)} record{Number(badgeCount) === 1 ? "" : "s"}</span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border space-y-1">
        {loading && <div className="text-xs t-tertiary">Loading…</div>}
        {err && !loading && <div className="text-xs text-red">err: {err.slice(0, 60)}</div>}
        {headline && (
          <div className="text-sm t-primary font-medium truncate">{String(headline)}</div>
        )}
        {detail && (
          <div className="text-xs t-secondary">${String(detail).replace(/^\$/, "")}</div>
        )}
        {!headline && !loading && !err && (
          <div className="text-xs t-tertiary italic">No matching records — run seed.</div>
        )}
      </div>
    </div>
  );
}
