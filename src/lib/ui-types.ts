// Minimal UI types used across components. ChatMessage matches what
// useChat returns — same shape simple/'s ChatPopup.tsx consumes.

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "tool" | "status";
  text: string;
  time: string;
}
