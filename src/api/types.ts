// Wire shapes shared with apteva-server. Keep field names exact.

export interface User { user_id: number; email?: string; }

export interface Instance {
  id: number;
  user_id: number;
  name: string;
  directive: string;
  mode: string;
  status: "running" | "stopped";
  project_id?: string;
  created_at: string;
}

export interface MCPServer {
  id: number;
  name: string;
  description: string;
  status: string;
  source: string;       // "local" | "remote" | "app" | "custom"
  transport?: string;   // "http" | "stdio"
  url?: string;
  connection_id?: number;
  project_id?: string;
  tool_count?: number;
}

export interface CallToolResult {
  success: boolean;
  status: number;
  data: any;
}

// MCP tools/call response envelope (HubSpot-style — same shape used by
// every standards-compliant MCP server).
export interface MCPContentEnvelope {
  content: Array<{ type: string; text?: string; [k: string]: any }>;
  isError?: boolean;
}

export interface ChannelChat {
  id: number;
  instance_id: number;
  name: string;
  created_at: string;
}

export interface ChannelChatMessage {
  id: number;
  chat_id: number;
  role: "user" | "agent";
  content: string;
  created_at: string;
}

export interface TelemetryEvent {
  id: string;
  instance_id: number;
  thread_id: string;
  type: string;
  time: string;
  data: Record<string, any>;
}
