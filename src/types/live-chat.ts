// File: types/live-chat.ts
export type ChatSender = "customer" | "admin" | "system" | "notice";

export interface ChatPayload {
  id: number;
  conversation_id: number;
  sender: ChatSender;
  body: string;
  created_at: string;
}

export interface ConversationSummary {
  id: number;
  customer_name: string;
  customer_email: string | null;
  status: "open" | "closed";
  unread_admin: number;
  last_message_at: string | null;
  last_message: string | null;
}
