import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat.ts";

interface Props {
  instanceId: number | null;
}

/**
 * Floating chat dock anchored bottom-right of the demo screen.
 * Collapsible — closed by default to keep the kiosk view clean.
 * Reuses simple/'s channel-chat plumbing verbatim through useChat.
 */
export function ChatDock({ instanceId }: Props) {
  const [open, setOpen] = useState(false);
  const { messages, ready, send } = useChat(open && instanceId ? instanceId : null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, messages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    send(text);
    setInput("");
  };

  if (!instanceId) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 h-11 px-4 rounded-full bg-accent text-white text-sm font-medium shadow-lg hover:opacity-90 transition-opacity"
      >
        💬 Ask the agent
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[480px] glass rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold t-primary">Chat with the agent</span>
        <button onClick={() => setOpen(false)} className="t-tertiary hover:t-primary text-lg leading-none">×</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {!ready && <div className="t-tertiary text-xs italic">Connecting…</div>}
        {ready && messages.length === 0 && (
          <div className="t-tertiary text-xs italic">
            Ask anything — "why did Acme go red?", "what's the status on Globex?", etc.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={[
              "rounded-lg px-3 py-1.5 text-sm",
              m.role === "user"
                ? "bg-accent-light t-primary self-end max-w-[85%] ml-auto"
                : "glass-inset t-primary max-w-[90%]",
            ].join(" ")}
          >
            <div className="text-[10px] t-tertiary mb-0.5">{m.role} · {m.time}</div>
            <div className="whitespace-pre-wrap break-words">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-border">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={ready ? "Ask the agent…" : "Waiting…"}
          rows={2}
          className="w-full text-sm rounded-lg glass-inset px-2 py-1.5 t-primary resize-none focus:outline-none"
          disabled={!ready}
        />
      </div>
    </div>
  );
}
