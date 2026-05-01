// Demo profile loader. Profiles live as JSON files in src/demos/ and
// are bundled into the build (bun's import attribute = "json"). The
// UI is a renderer over these — adding a new client demo means
// dropping in one JSON, no UI code changes.

import type { RecipeStep } from "./recipe.ts";

import hubspotEmailMonitor from "../demos/hubspot-email-monitor.json" with { type: "json" };

export interface DemoProfile {
  id: string;
  label: string;
  /**
   * Which Apteva instance to talk to. Operator wires the real id at
   * runtime via window.__APTEVA_APP__.instance_id (config_schema in
   * apteva.yaml) or via ?instance= URL param. The profile's
   * `instance_binding` is just a hint for picking when multiple
   * instances exist.
   */
  instance_binding?: { kind: "by_name"; name: string };
  /**
   * Slug of the primary MCP server this demo runs against. The runner
   * resolves it to an mcp_servers row id at session start.
   */
  primary_mcp: { slug: string };
  scenarios: Scenario[];
  seed: { steps: RecipeStep[] };
  reset: { steps: RecipeStep[] };
}

export interface Scenario {
  id: string;
  /** Card heading. */
  company: string;
  /** Risk badge. */
  severity: "red" | "amber" | "green";
  /** Subtitle on the card. */
  tagline: string;
  /**
   * Live data the card shows. The runner executes this single tool
   * call every poll interval and renders the JSON response via the
   * declared `render` paths.
   */
  live_query: { tool: string; args: any };
  /** What to display inside the card from the live query response. */
  render: {
    headline: string;       // path into the response JSON
    detail?: string;
    badge_count?: string;   // numeric path → shown as "N records"
  };
  /**
   * Single-step recipe that simulates the inbound email for this
   * scenario. Uses sendEvent on the agent's instance so the agent's
   * directive picks it up like any other inbound. No real Outlook
   * traffic involved — that's a separate phase.
   */
  trigger: { message: string };
}

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
