// Recipe runner — executes a sequence of MCP tool calls with
// variable interpolation between steps. Used for seed, reset, and
// (single-step) trigger recipes. Same primitive in all three places.
//
// A step's `args` may contain `${var}` placeholders that resolve
// against an in-memory ctx. Steps can `capture` values from their
// response back into ctx for use by later steps. That's enough to
// chain "create companies → use their IDs to associate contacts →
// use contact IDs to associate deals" without server-side coupling.

import { callTool, callToolJSON } from "../api/mcp.ts";

export interface RecipeStep {
  id: string;
  label: string;
  tool: string;
  args: any;
  /** Pull values out of the response into ctx for later steps. */
  capture?: Capture[];
  /** Server id override (default: the recipe's primary MCP). */
  serverId?: number;
}

export interface Capture {
  /** Variable name to set in ctx. */
  as: string;
  /**
   * Path into the parsed JSON body.
   * Supports:
   *   - dot/bracket paths: "results[0].id", "createResults.results"
   *   - array projection: "results[].id" → flat array of ids
   *   - filtered projection: "createResults.results[displayName == 'Acme'].objectId"
   *
   * Path is evaluated against the *parsed JSON inside the MCP content
   * envelope* — so you write `results[].id`, not
   * `content[0].text.results...`.
   */
  field: string;
}

export type StepStatus = "pending" | "running" | "ok" | "error" | "skipped";

export interface StepProgress {
  index: number;
  step: RecipeStep;
  status: StepStatus;
  message?: string;
  /** Free-form summary the UI can render — e.g. "9 created" or "5 found". */
  summary?: string;
}

/**
 * Run a recipe top-to-bottom. Each step's result feeds into the
 * `ctx` map via its `capture` directives; later steps' `args` can
 * reference those values via `${name}` placeholders.
 *
 * Returns the final ctx so the caller can chain follow-up logic
 * (e.g. seed produced a contact_id we want to deep-link to).
 *
 * Errors are surfaced through `onProgress({status: "error", ...})`
 * and the whole recipe stops at the first error. The runner is
 * deliberately not retry-aware — that lives at the UI level.
 */
export async function runRecipe(
  steps: RecipeStep[],
  primaryServerId: number,
  ctx: Record<string, unknown>,
  onProgress: (p: StepProgress) => void,
): Promise<Record<string, unknown>> {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    onProgress({ index: i, step, status: "running" });

    const args = interpolate(step.args, ctx);
    const sid = step.serverId ?? primaryServerId;

    const res = await callToolJSON<any>(sid, step.tool, args);
    if (!res.ok) {
      onProgress({ index: i, step, status: "error", message: res.error });
      throw new Error(`step ${step.id}: ${res.error}`);
    }

    // Run captures
    for (const cap of step.capture ?? []) {
      ctx[cap.as] = selectFromResult(res.data, cap.field);
    }

    onProgress({
      index: i,
      step,
      status: "ok",
      summary: summarizeResult(res.data),
    });
  }
  return ctx;
}

// ─── interpolation ───
// Walk an object tree replacing `${var}` placeholders. Pure-string
// placeholders that point at a single value substitute the value
// itself (preserving its type — number stays a number, array stays
// an array). Embedded placeholders inside a longer string are
// stringified and concatenated, the way template literals would.
//
// Example:
//   { id: "${acme_id}", body: "Hello ${name}" }, ctx={acme_id: 42, name: "Sarah"}
//   → { id: 42, body: "Hello Sarah" }
export function interpolate(value: any, ctx: Record<string, unknown>): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => interpolate(v, ctx));
  if (typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v, ctx);
    return out;
  }
  if (typeof value !== "string") return value;

  // Whole-string placeholder — substitute the typed value.
  const whole = /^\$\{([^}]+)\}$/.exec(value);
  if (whole) {
    const key = whole[1]!.trim();
    return key in ctx ? (ctx[key] as any) : "";
  }
  // Embedded placeholders — stringify each and splice.
  return value.replace(/\$\{([^}]+)\}/g, (_, k: string) => {
    const v = ctx[k.trim()];
    if (v == null) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
  });
}

// ─── path selection (inline jq-lite) ───
// Supports:
//   "a.b"               → walk
//   "a[0].b"            → array index
//   "items[].name"      → project across array
//   "items[k=='v'].id"  → filter on equality (string only)
export function selectFromResult(data: any, path: string): any {
  if (!path) return data;
  const parts = tokenize(path);
  let curr: any = data;
  for (const tok of parts) {
    if (curr == null) return undefined;
    if (tok.kind === "field") {
      curr = curr[tok.name];
    } else if (tok.kind === "index") {
      curr = Array.isArray(curr) ? curr[tok.value] : undefined;
    } else if (tok.kind === "project") {
      // Project the rest of the path across the array
      if (!Array.isArray(curr)) return [];
      return curr.map((el) => selectFromResult(el, tok.rest)).filter((v) => v !== undefined);
    } else if (tok.kind === "filter") {
      if (!Array.isArray(curr)) return undefined;
      const match = curr.find((el) => {
        const lhs = selectFromResult(el, tok.field);
        return String(lhs) === tok.value;
      });
      curr = match;
    }
  }
  return curr;
}

type Tok =
  | { kind: "field"; name: string }
  | { kind: "index"; value: number }
  | { kind: "project"; rest: string }
  | { kind: "filter"; field: string; value: string };

function tokenize(path: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === "[") {
      const close = path.indexOf("]", i);
      if (close < 0) throw new Error(`unclosed bracket in path: ${path}`);
      const inner = path.slice(i + 1, close).trim();
      if (inner === "") {
        // [] — projection across rest of path
        const rest = path.slice(close + 1).replace(/^\./, "");
        out.push({ kind: "project", rest });
        return out;
      }
      // [N] index
      if (/^\d+$/.test(inner)) {
        out.push({ kind: "index", value: Number(inner) });
        i = close + 1;
        continue;
      }
      // [field=='value'] filter
      const filter = /^([\w.]+)\s*==\s*['"]([^'"]*)['"]$/.exec(inner);
      if (filter) {
        out.push({ kind: "filter", field: filter[1]!, value: filter[2]! });
        i = close + 1;
        continue;
      }
      throw new Error(`unsupported bracket expr in path: ${inner}`);
    }
    if (path[i] === ".") {
      i++;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== "." && path[j] !== "[") j++;
    const name = path.slice(i, j);
    if (name) out.push({ kind: "field", name });
    i = j;
  }
  return out;
}

// ─── response summarization ───
// Generates a one-line "5 created" / "9 found" summary from common
// MCP response shapes (search_crm_objects + manage_crm_objects).
function summarizeResult(data: any): string {
  if (!data || typeof data !== "object") return "";
  if ("createResults" in data) {
    const s = data.createResults?.summary;
    if (s) return `${s.created ?? s.totalSucceeded ?? "?"} created`;
  }
  if ("updateResults" in data) {
    const s = data.updateResults?.summary;
    if (s) return `${s.updated ?? s.totalSucceeded ?? "?"} updated`;
  }
  if ("results" in data && Array.isArray(data.results)) {
    return `${data.total ?? data.results.length} found`;
  }
  return "ok";
}
