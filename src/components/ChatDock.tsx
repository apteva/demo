import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
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
 <span className="inline-flex items-center gap-2"><MessageSquare className="w-4 h-4" />Ask the agent</span>
 </button>
 );
 }

 return (
 <div className="fixed bottom-4 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[480px] bg-bg-card border border-border shadow-card rounded-2xl shadow-2xl flex flex-col overflow-hidden">
 <div className="flex items-center justify-between px-3 py-2 border-b border-border">
 <span className="text-sm font-semibold text-text">Chat with the agent</span>
 <button onClick={() => setOpen(false)} className="text-text-dim hover:text-text text-lg leading-none">×</button>
 </div>

 <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
 {!ready && <div className="text-text-dim text-xs italic">Connecting…</div>}
 {ready && messages.length === 0 && (
 <div className="text-text-dim text-xs italic">
 Ask anything —"why did Acme go red? ","what's the status on Globex? ", etc.
 </div>
 )}
 {messages.map((m) => (
 <div
 key={m.id}
 className={["rounded-lg px-3 py-1.5 text-sm",
 m.role === "user"
 ? "bg-accent/10 text-text self-end max-w-[85%] ml-auto"
 : "bg-bg-hover border border-border text-text max-w-[90%]",
 ].join(" ")}
 >
 <div className="text-[11px] text-text-dim mb-0.5">{m.role} · {m.time}</div>
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
 placeholder={ready ? "Ask the agent…" :"Waiting…"}
 rows={2}
 className="w-full text-sm rounded-lg bg-bg-hover border border-border px-2 py-1.5 text-text resize-none focus:outline-none"
 disabled={!ready}
 />
 </div>
 </div>
 );
}
