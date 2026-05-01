import { useEffect, useRef, useState } from "react";
import * as chatApi from "../api/chat.ts";
import type { ChannelChatMessage } from "../api/types.ts";
import type { ChatMessage } from "../lib/ui-types.ts";

function toUI(m: ChannelChatMessage): ChatMessage {
  return {
    id: String(m.id),
    role: m.role,
    text: m.content,
    time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

// Live chat with an instance. `instanceId` enables the hook; the hook
// resolves the default chat id, backfills message history, and opens
// an SSE stream for new messages. `send` POSTs to the server; the
// echoed message arrives back via the stream.
export function useChat(instanceId: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinceRef = useRef(0);
  const seen = useRef(new Set<number>());

  useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;
    setReady(false);
    seen.current = new Set();
    sinceRef.current = 0;
    setMessages([]);

    let handle: { close: () => void } | null = null;

    chatApi.listChats(instanceId)
      .then(async (chats) => {
        if (cancelled) return;
        if (chats.length === 0) {
          setReady(true);
          return;
        }
        const cid = chats[0]!.id;
        setChatId(cid);

        // Backfill
        const hist = await chatApi.listMessages(cid, 0).catch(() => []);
        for (const m of hist) {
          seen.current.add(m.id);
          if (m.id > sinceRef.current) sinceRef.current = m.id;
        }
        if (!cancelled) {
          setMessages(hist.map(toUI));
          setReady(true);
        }

        // Stream
        handle = chatApi.streamChat(cid, sinceRef.current, (m) => {
          if (seen.current.has(m.id)) return;
          seen.current.add(m.id);
          sinceRef.current = Math.max(sinceRef.current, m.id);
          setMessages((prev) => [...prev, toUI(m)]);
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err?.body ?? String(err));
      });

    return () => {
      cancelled = true;
      if (handle) handle.close();
    };
  }, [instanceId]);

  const send = async (content: string) => {
    if (!chatId) return;
    try {
      await chatApi.sendMessage(chatId, content.trim());
      // Echo arrives via stream.
    } catch (err: any) {
      setError(err?.body ?? String(err));
    }
  };

  return { messages, ready, chatId, send, error };
}
