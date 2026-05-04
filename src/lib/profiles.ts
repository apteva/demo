// Demo profile loader. Profiles live as JSON under src/demos/ and are
// bundled into the build (bun's import attribute = "json"). The UI is
// a renderer over these — adding a new client demo means dropping in
// one JSON, no UI code changes.
//
// Schema v2 introduces a `layout` block with named slots that
// IntegrationCard renders generically. Per-scenario tile stacks
// replace the v1 `live_query` / `render` ScenarioCard rendering.

import type { RecipeStep } from "./recipe.ts";
import type { TileSpec } from "../components/IntegrationCard.tsx";
import type { PropsMap } from "./projection.ts";

import hubspotEmailMonitor from "../demos/hubspot-email-monitor.json" with { type: "json" };

// ─── profile types ─────────────────────────────────────────────────

export interface DemoProfile {
  id: string;
  label: string;
  /** App slug (resolves to a registered MCP server connection). */
  primary_app: string;
  /** Hint for picking the right agent instance when several exist. */
  instance_binding?: { kind: "by_name"; name: string };
  /** Optional per-profile branding/access — Phase 2 (multi-tenant);
   *  fields are tolerated in JSON today and used by the SPA when
   *  present. */
  branding?: BrandingConfig;
  /** Static props injected into every tile (e.g. portal_id, theme). */
  context_props?: Record<string, unknown>;
  /** Layout drives what tiles render where. */
  layout: Layout;
  /** Operator controls — trigger buttons + scenario metadata. */
  scenarios: Scenario[];
  /** Seed + reset recipes — unchanged from v1. */
  seed: { steps: RecipeStep[] };
  reset: { steps: RecipeStep[] };
}

export interface BrandingConfig {
  logo?: string;
  header_label?: string;
  theme?: "light" | "dark";
  hide_apteva_chrome?: boolean;
  theme_css?: string;
}

export interface Layout {
  /** Optional full-width tile across the top (typically a pipeline strip
   *  or KPI dashboard). */
  header_tile?: TileSpec;
  /** Customer-state grid — each entry is a stack of cards for one
   *  scenario. */
  customer_state: ScenarioGroup[];
  /** Activity surface below the grid. */
  activity?: TileSpec;
}

export interface ScenarioGroup {
  /** Matches a scenario id so the trigger pulses the right group. */
  id: string;
  title: string;
  severity?: "red" | "amber" | "green";
  tagline?: string;
  tiles: TileSpec[];
}

export interface Scenario {
  id: string;
  /** Trigger button label. */
  company: string;
  severity: "red" | "amber" | "green";
  tagline: string;
  /** Single-step recipe that simulates the inbound event. */
  trigger: { message: string };
}

export type { TileSpec, PropsMap };

// ─── registry ──────────────────────────────────────────────────────

const REGISTRY: Record<string, DemoProfile> = {
  "hubspot-email-monitor": hubspotEmailMonitor as unknown as DemoProfile,
};

export function listProfiles(): Array<{ id: string; label: string }> {
  return Object.values(REGISTRY).map(({ id, label }) => ({ id, label }));
}

export function getProfile(id: string): DemoProfile | null {
  return REGISTRY[id] ?? null;
}

/**
 * Resolve the default profile id from (in order):
 *   1. URL ?demo=<id>
 *   2. window.__APTEVA_APP__.default_profile (apteva.yaml config)
 *   3. first profile in the registry
 */
export function defaultProfileId(): string {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("demo");
  if (fromUrl && REGISTRY[fromUrl]) return fromUrl;
  const installed = (window as any).__APTEVA_APP__;
  if (installed && typeof installed.default_profile === "string" && REGISTRY[installed.default_profile]) {
    return installed.default_profile;
  }
  return Object.keys(REGISTRY)[0] ?? "hubspot-email-monitor";
}
