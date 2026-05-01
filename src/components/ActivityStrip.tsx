import { useEffect, useRef, useState } from "react";
import { sseUrl } from "../api/client.ts";
import type { TelemetryEvent } from "../api/types.ts";

interface Props {
  instanceId: number | null;
  /** Notified whenever a tool call event lands; lets the parent pulse cards. */
  onToolCall?: (event: TelemetryEvent) => void;
}

interface Item {
  id: string;
  time: string;
  text: string;
}

/**
 * Streams telemetry events from the agent and shows the last N as
 * one-line summaries. Bottom-left strip in the demo screen — small
 * enough not to dominate, big enough to convey "the agent is doing
 * stuff right now".
 *
 * Uses the existing /telemetry/stream SSE endpoint that simple/ also
 * uses, so no new server-side surface needed.
 */
export function ActivityStrip({ instanceId, onToolCall }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    if (!instanceId) return;
    seenRef.current = new Set();
    setItems([]);

    const url = sseUrl("/telemetry/stream", { instance_id: instanceId });
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = (msg) => {
      if (!msg.data) return;
      let ev: TelemetryEvent;
      try { ev = JSON.parse(msg.data); } catch { return; }
      if (seenRef.current.has(ev.id)) return;
      seenRef.current.add(ev.id);

      const summary = summarize(ev);
      if (summary) {
        setItems((prev) => [
          { id: ev.id, time: formatTime(ev.time), text: summary },
          ...prev,
        ].slice(0, 6));
      }
      if (ev.type === "tool.call" && onToolCall) onToolCall(ev);
    };
    return () => es.close();
  }, [instanceId, onToolCall]);

  if (!instanceId) {
    return <div className="t-tertiary text-xs italic">No agent bound — set ?instance=N or pick one.</div>;
  }

  if (items.length === 0) {
    return <div className="t-tertiary text-xs italic">Waiting for agent activity…</div>;
  }

  return (
    <ul className="space-y-1 text-xs">
      {items.map((it) => (
        <li key={it.id} className="flex items-baseline gap-2">
          <span className="t-tertiary tabular-nums w-12 shrink-0">{it.time}</span>
          <span className="t-primary truncate">{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

function summarize(ev: TelemetryEvent): string | null {
  switch (ev.type) {
    case "tool.call": {
      const name = ev.data?.tool ?? ev.data?.name ?? "tool";
      return `→ ${name}(${shortArgs(ev.data?.args)})`;
    }
    case "tool.result": {
      const name = ev.data?.tool ?? ev.data?.name ?? "tool";
      const ok = ev.data?.success !== false;
      return `${ok ? "✓" : "×"} ${name} ${ev.data?.duration_ms ? `(${ev.data.duration_ms}ms)` : ""}`.trim();
    }
    case "thread.spawn":  return `+ thread ${ev.data?.directive ? `"${truncate(ev.data.directive, 50)}"` : ""}`;
    case "thread.done":   return `− thread done`;
    case "event.received": return `event: ${truncate(String(ev.data?.message ?? ""), 60)}`;
    case "instance.paused":  return "agent paused";
    case "instance.resumed": return "agent resumed";
    case "llm.start":  return null;   // too noisy
    case "llm.done":   return null;
    default:           return null;
  }
}

function shortArgs(args: any): string {
  if (!args || typeof args !== "object") return "";
  const keys = Object.keys(args);
  if (keys.length === 0) return "";
  return keys.slice(0, 2).join(",") + (keys.length > 2 ? "…" : "");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}
