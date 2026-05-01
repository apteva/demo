import { apiFetch, sseUrl } from "./client.ts";
import type { ChannelChat, ChannelChatMessage } from "./types.ts";

export function listChats(instanceId: number): Promise<ChannelChat[]> {
  return apiFetch<ChannelChat[]>(`/apps/channel-chat/chats?instance_id=${instanceId}`);
}

export function listMessages(chatId: number, since = 0): Promise<ChannelChatMessage[]> {
  return apiFetch<ChannelChatMessage[]>(`/apps/channel-chat/messages?chat_id=${chatId}&since=${since}`);
}

export function sendMessage(chatId: number, content: string): Promise<ChannelChatMessage> {
  return apiFetch<ChannelChatMessage>(`/apps/channel-chat/messages?chat_id=${chatId}`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export interface ChatStreamHandle {
  close: () => void;
}

export function streamChat(
  chatId: number,
  since: number,
  onMessage: (msg: ChannelChatMessage) => void,
  onError?: (err: Event) => void,
): ChatStreamHandle {
  const url = sseUrl("/apps/channel-chat/stream", { chat_id: chatId, since });
  const es = new EventSource(url, { withCredentials: true });
  es.onmessage = (msg) => {
    if (!msg.data) return;
    try {
      onMessage(JSON.parse(msg.data) as ChannelChatMessage);
    } catch {}
  };
  if (onError) es.onerror = onError;
  return { close: () => es.close() };
}
