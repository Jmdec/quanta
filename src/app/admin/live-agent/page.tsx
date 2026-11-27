// File: app/admin/live-chat/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { ChatPayload, ConversationSummary } from "@/types/live-chat";

const POLL_MS = 3000;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Request failed");
  }
  return json.data as T;
}

const time = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export default function AdminLiveChatPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatPayload[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [connected, setConnected] = useState(false);

  const selectedRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Polling: inbox + the open conversation, every few seconds.
  useEffect(() => {
    let stop = false;
    let busy = false;

    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const list = await api<ConversationSummary[]>(
          "/api/admin/chat/conversations",
        );
        if (stop) return;

        const openId = selectedRef.current;
        // the open conversation is being read, so never show it as unread
        setConversations(
          list.map((c) => (c.id === openId ? { ...c, unread_admin: 0 } : c)),
        );

        if (openId) {
          const d = await api<{ messages: ChatPayload[] }>(
            `/api/admin/chat/conversations/${openId}`,
          );
          if (stop || selectedRef.current !== openId) return;
          setMessages((prev) =>
            prev.length === d.messages.length &&
            prev[prev.length - 1]?.id === d.messages[d.messages.length - 1]?.id
              ? prev
              : d.messages,
          );
        }
        setConnected(true);
      } catch {
        if (!stop) setConnected(false);
      } finally {
        busy = false;
      }
    };

    refreshRef.current = refresh;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  async function openConversation(id: number) {
    setSelectedId(id);
    selectedRef.current = id;
    setMessages([]);
    try {
      const d = await api<{ messages: ChatPayload[] }>(
        `/api/admin/chat/conversations/${id}`,
      );
      if (selectedRef.current !== id) return;
      setMessages(d.messages);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread_admin: 0 } : c)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load chat");
    }
  }

  async function sendReply() {
    const body = input.trim();
    if (!body || !selectedId || isSending) return;
    setIsSending(true);
    try {
      const msg = await api<ChatPayload>(
        `/api/admin/chat/conversations/${selectedId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      setInput("");
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
      refreshRef.current();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setIsSending(false);
    }
  }

  async function closeConversation() {
    if (!selectedId) return;
    try {
      await api(`/api/admin/chat/conversations/${selectedId}/close`, {
        method: "POST",
      });
      toast.success("Chat closed.");
      refreshRef.current();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close");
    }
  }

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Live Chat</h1>
            <p className="mt-1 text-sm text-gray-500">
              Customer messages appear here within a few seconds. Replies reach
              them the same way.
            </p>
          </div>
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              connected
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {connected ? "Live" : "Connecting…"}
          </span>
        </div>

        <div className="mt-5 grid h-[70vh] overflow-hidden rounded-xl border border-gray-200 bg-white md:grid-cols-[300px_1fr]">
          {/* Inbox */}
          <div className="overflow-y-auto border-b border-gray-200 md:border-b-0 md:border-r">
            {conversations.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">
                No conversations yet.
              </p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${
                  c.id === selectedId ? "bg-gray-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {c.customer_name}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {time(c.last_message_at)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-500">
                    {c.last_message ?? "New chat"}
                  </span>
                  {c.unread_admin > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {c.unread_admin}
                    </span>
                  )}
                  {c.status === "closed" && (
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                      closed
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Conversation */}
          <div className="flex min-h-0 flex-col">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selected.customer_name}
                    </p>
                    {selected.customer_email && (
                      <p className="text-xs text-gray-500">
                        {selected.customer_email}
                      </p>
                    )}
                  </div>
                  {selected.status === "open" && (
                    <button
                      onClick={closeConversation}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Close chat
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
                  {messages.map((m) =>
                    m.sender === "system" || m.sender === "notice" ? (
                      <p
                        key={m.id}
                        className="text-center text-xs text-gray-400"
                      >
                        {m.body}
                      </p>
                    ) : (
                      <div
                        key={m.id}
                        className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                            m.sender === "admin"
                              ? "rounded-br-sm bg-gray-900 text-white"
                              : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                          }`}
                        >
                          {m.body}
                          <div className="mt-1 text-[10px] text-gray-400">
                            {time(m.created_at)}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                  <div ref={endRef} />
                </div>

                <div className="flex gap-2 border-t border-gray-200 p-3">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendReply()}
                    maxLength={1000}
                    placeholder="Type a reply…"
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                  <button
                    onClick={sendReply}
                    disabled={!input.trim() || isSending}
                    aria-label="Send reply"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
