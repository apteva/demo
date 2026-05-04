// IntegrationCard — generic tile renderer. Reads a TileSpec from the
// profile, looks up the React component in the registry, runs the
// declared MCP fetch, projects the response into props, and renders.
//
// Lifecycle:
//   - mount → preview render (so the tile has shape immediately)
//   - run fetch → on success, swap to real props
//   - on tool-call event for this tile → debounce + refetch
//
// Errors render an inline diagnostic strip on top of the preview
// so the demo never goes blank during a meeting.

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveComponent } from "../api/registry.ts";
import { projectProps, type PropsMap } from "../lib/projection.ts";
import { callToolJSON } from "../api/mcp.ts";

export interface TileSpec {
  /** Component name in the integration's registry (e.g. "deal-card"). */
  component: string;
  /** Optional MCP tool call to produce the component's props. */
  fetch?: { tool: string; args?: unknown };
  /** Map of component-prop → response path / template / literal. */
  props_from_result?: PropsMap;
  /** Static props merged on top of the projected ones. */
  static_props?: Record<string, unknown>;
  /** Auto-refresh cadence in seconds (0 = once on mount, default 0). */
  refresh_seconds?: number;
}

interface Props {
  spec: TileSpec;
  /** Integration slug (e.g. "hubspot") — picks the registry namespace. */
  appSlug: string;
  /** Resolved MCP server id for this integration. Required for fetch. */
  serverId: number | null;
  /** Optional: HubSpot portal_id (or similar) injected into every tile. */
  contextProps?: Record<string, unknown>;
  /** Pulse the tile (e.g. when its scenario was just triggered). */
  pulse?: boolean;
}

export function IntegrationCard({ spec, appSlug, serverId, contextProps, pulse }: Props) {
  const Component = resolveComponent(appSlug, spec.component);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  const runFetch = useCallback(async () => {
    if (!spec.fetch || !serverId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callToolJSON<unknown>(serverId, spec.fetch.tool, spec.fetch.args ?? {});
      if (!res.ok) {
        setError(res.error || "fetch failed");
      } else {
        setData(res.data);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [spec.fetch, serverId]);

  useEffect(() => {
    if (!spec.fetch || !serverId) return;
    runFetch();
    if (spec.refresh_seconds && spec.refresh_seconds > 0) {
      refreshTimer.current = window.setInterval(runFetch, spec.refresh_seconds * 1000);
      return () => {
        if (refreshTimer.current) window.clearInterval(refreshTimer.current);
      };
    }
    return undefined;
  }, [runFetch, spec.fetch, spec.refresh_seconds, serverId]);

  if (!Component) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-text-dim">
        Unknown component: <code className="text-text">{appSlug}/{spec.component}</code>
      </div>
    );
  }

  // Decide which props to render with.
  // - No fetch declared → render with static_props + contextProps directly
  //   (component handles its own data). If neither, use preview.
  // - Fetch declared but no data yet → preview (so the tile has shape)
  // - Fetch errored → preview + small error strip
  // - Fetch succeeded → projected props + static_props on top
  const projected = data ? projectProps(data, spec.props_from_result) : {};
  const noData = !spec.fetch && !spec.static_props;
  const shouldPreview = noData || (spec.fetch && !data);

  const finalProps: Record<string, unknown> = shouldPreview
    ? { preview: true, ...(spec.static_props ?? {}), ...(contextProps ?? {}) }
    : { ...(contextProps ?? {}), ...projected, ...(spec.static_props ?? {}) };

  return (
    <div className={`relative ${pulse ? "ring-2 ring-accent/60 rounded-md" : ""}`}>
      <Component {...finalProps} />
      {error && (
        <div className="absolute top-1 right-1 text-[10px] text-error bg-error/10 px-1.5 py-0.5 rounded" title={error}>
          ⚠ {loading ? "retrying" : "fetch failed"}
        </div>
      )}
      {loading && !data && (
        <div className="absolute top-1 right-1 text-[10px] text-text-dim">loading…</div>
      )}
    </div>
  );
}
