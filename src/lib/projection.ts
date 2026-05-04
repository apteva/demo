// Projects an MCP tool response into a flat React-component props
// object via a `props_from_result` mapping.
//
// Mapping shape (string | object):
//
//   "results[0].properties.dealname"              ← simple path
//   { path: "results[].id", default: [] }         ← path + fallback
//   { literal: "default" }                        ← static value
//   { template: "${results[0].properties.dealname} (#${results[0].id})" }
//                                                 ← embedded paths
//
// Path syntax matches lib/recipe.ts selectFromResult: dotted, [N]
// index, [] projection, [field=='value'] filter.
//
// Embedded ${path} placeholders inside `template` strings resolve
// against the same data via selectFromResult.

import { selectFromResult } from "./recipe.ts";

export type Mapping =
  | string
  | { path: string; default?: unknown }
  | { literal: unknown }
  | { template: string };

export type PropsMap = Record<string, Mapping>;

export function projectProps(data: unknown, map: PropsMap | undefined): Record<string, unknown> {
  if (!map) return {};
  const out: Record<string, unknown> = {};
  for (const [propName, m] of Object.entries(map)) {
    out[propName] = projectOne(data, m);
  }
  return out;
}

function projectOne(data: unknown, m: Mapping): unknown {
  if (typeof m === "string") {
    const v = selectFromResult(data, m);
    return v === undefined ? undefined : v;
  }
  if ("literal" in m) return m.literal;
  if ("path" in m) {
    const v = selectFromResult(data, m.path);
    return v === undefined ? m.default : v;
  }
  if ("template" in m) {
    return m.template.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
      const v = selectFromResult(data, expr.trim());
      if (v == null) return "";
      return typeof v === "string" ? v : String(v);
    });
  }
  return undefined;
}
