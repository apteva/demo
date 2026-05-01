import { apiFetch } from "./client.ts";
import type { CallToolResult, MCPContentEnvelope, MCPServer } from "./types.ts";

export function listMCPServers(): Promise<MCPServer[]> {
  return apiFetch<MCPServer[]>("/mcp-servers");
}

// Call one tool on one MCP server. The Apteva endpoint dispatches on
// source: remote (Composio + hosted MCPs) → upstream HTTP, local →
// catalog REST shim, app → bridge URL. We get back a uniform envelope
// regardless. With our auto-refresh wiring, an expired token triggers
// a transparent refresh + retry, so callers don't have to handle 401
// specifically.
export function callTool(
  serverId: number,
  tool: string,
  args: Record<string, any>,
): Promise<CallToolResult> {
  return apiFetch<CallToolResult>(`/mcp-servers/${serverId}/call-tool`, {
    method: "POST",
    body: JSON.stringify({ tool, args }),
  });
}

// Convenience: call a tool that returns the standard MCP `content`
// envelope, parse the embedded JSON-stringified text, and hand back
// whatever object/array it carries. Most HubSpot tools wrap their
// response this way; this helper saves every caller from repeating
// the dance.
export async function callToolJSON<T = unknown>(
  serverId: number,
  tool: string,
  args: Record<string, any>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await callTool(serverId, tool, args);
  if (!res.success) {
    return { ok: false, error: typeof res.data === "string" ? res.data : JSON.stringify(res.data) };
  }
  const env = res.data as MCPContentEnvelope;
  const text = env?.content?.[0]?.text ?? "";
  if (!text) return { ok: false, error: "empty content" };
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    // Not JSON — return as a string for tools whose payload is plain text.
    return { ok: true, data: text as unknown as T };
  }
}
