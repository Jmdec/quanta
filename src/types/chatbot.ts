// File: types/chatbot.ts
export type ChatbotResponseType = "answer" | "welcome" | "fallback";

export interface ChatbotResponse {
  id: number;
  title: string;
  type: ChatbotResponseType;
  keywords: string[];
  response: string;
  suggestions: string[];
  sort_order: number;
  is_menu: boolean;
  is_active: boolean;
}

export type ChatbotResponseFormValues = Omit<ChatbotResponse, "id">;

export interface ChatbotLog {
  message: string;
  total: number;
  last_asked_at: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
}

export interface ApiItemResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
