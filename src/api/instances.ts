import { apiFetch } from "./client.ts";
import type { Instance } from "./types.ts";

export function listInstances(projectId?: string): Promise<Instance[]> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return apiFetch<Instance[]>(`/instances${qs}`);
}

export function getInstance(id: number): Promise<Instance> {
  return apiFetch<Instance>(`/instances/${id}`);
}

export function startInstance(id: number): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/instances/${id}/start`, { method: "POST" });
}

export function stopInstance(id: number): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/instances/${id}/stop`, { method: "POST" });
}

// Synthesize an event into the agent's stream — used by demo trigger
// buttons to simulate "an email just arrived" without wiring real
// Outlook traffic. Apteva-server's POST /instances/:id/event accepts
// a free-form `message` and the agent's directive does the rest.
export function sendEvent(id: number, message: string): Promise<any> {
  return apiFetch<any>(`/instances/${id}/event`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
