// File: app/admin/live-chat/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Search, Send } from "lucide-react";
import { ChatPayload, ConversationSummary } from "@/types/live-chat";

const POLL_MS = 3000;

type Filter = "all" | "unread" | "closed";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Request failed");
  }
  return json.data as T;
}

const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

/** Inbox time: clock for today, short date otherwise. */
function inboxTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? clock(iso)
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800 ${
        size === "lg" ? "h-11 w-11 text-base" : "h-10 w-10 text-sm"
      }`}
    >
      {initials(name)}
    </span>
  );
}

export default function AdminLiveChatPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatPayload[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const selectedRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastKeyRef = useRef("");
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  // Scroll to the newest message only when it changes (not on every poll).
  useEffect(() => {
    const last = messages[messages.length - 1];
    const key = `${selectedId}:${last?.id ?? 0}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, selectedId]);

  // Polling: inbox + the open conversation.
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
  const unreadTotal = conversations.reduce((n, c) => n + c.unread_admin, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread_admin === 0) return false;
      if (filter === "closed" && c.status !== "closed") return false;
      if (!q) return true;
      return (
        c.customer_name.toLowerCase().includes(q) ||
        (c.last_message ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, query]);

  // Insert a date divider whenever the day changes.
  const timeline = useMemo(() => {
    const out: Array<
      | { type: "day"; key: string; label: string }
      | { type: "msg"; m: ChatPayload }
    > = [];
    let prevDay = "";
    for (const m of messages) {
      const day = new Date(m.created_at).toDateString();
      if (day !== prevDay) {
        out.push({
          type: "day",
          key: `d-${m.id}`,
          label: dayLabel(m.created_at),
        });
        prevDay = day;
      }
      out.push({ type: "msg", m });
    }
    return out;
  }, [messages]);

  const tabs: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: unreadTotal },
    { id: "closed", label: "Closed" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Live chat
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Customers who asked to talk to a person. Updates every few seconds.
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

      <div className="flex h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* ───────── Inbox ───────── */}
        <aside
          className={`${
            selectedId ? "hidden md:flex" : "flex"
          } w-full shrink-0 flex-col border-neutral-200 md:w-[340px] md:border-r`}
        >
          <div className="space-y-3 border-b border-neutral-200 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or message"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm text-neutral-900 caret-emerald-700 placeholder-neutral-500 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    filter === t.id
                      ? "bg-emerald-800 text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {t.label}
                  {!!t.count && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold ${
                        filter === t.id
                          ? "bg-white/25 text-white"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 && (
              <p className="p-8 text-center text-sm text-neutral-500">
                {conversations.length === 0
                  ? "No conversations yet."
                  : "No chats match this view."}
              </p>
            )}
            {visible.map((c) => {
              const active = c.id === selectedId;
              const unread = c.unread_admin > 0;
              return (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`relative flex w-full items-start gap-3 border-b border-neutral-100 px-4 py-3.5 text-left transition hover:bg-neutral-50 ${
                    active ? "bg-emerald-50/70" : ""
                  }`}
                >
                  {active && (
                    <span className="absolute inset-y-0 left-0 w-1 bg-emerald-700" />
                  )}
                  <Avatar name={c.customer_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          unread
                            ? "font-semibold text-neutral-900"
                            : "font-medium text-neutral-800"
                        }`}
                      >
                        {c.customer_name}
                      </span>
                      <span
                        className={`shrink-0 text-xs ${
                          unread
                            ? "font-medium text-emerald-700"
                            : "text-neutral-400"
                        }`}
                      >
                        {inboxTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-[13px] ${
                          unread ? "text-neutral-700" : "text-neutral-500"
                        }`}
                      >
                        {c.last_message ?? "New chat"}
                      </span>
                      {unread ? (
                        <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {c.unread_admin}
                        </span>
                      ) : c.status === "closed" ? (
                        <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                          Closed
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ───────── Conversation ───────── */}
        <section
          className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-neutral-50 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <MessageSquare className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-medium text-neutral-800">
                  Select a conversation
                </p>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Pick a chat on the left to read and reply.
                </p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to inbox"
                  className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar name={selected.customer_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-neutral-900">
                    {selected.customer_name}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-neutral-500">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        selected.status === "open"
                          ? "text-emerald-700"
                          : "text-neutral-500"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          selected.status === "open"
                            ? "bg-emerald-500"
                            : "bg-neutral-400"
                        }`}
                      />
                      {selected.status === "open" ? "Open" : "Closed"}
                    </span>
                    {selected.customer_email && (
                      <span className="truncate">
                        {selected.customer_email}
                      </span>
                    )}
                  </p>
                </div>
                {selected.status === "open" && (
                  <button
                    onClick={closeConversation}
                    className="rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Close chat
                  </button>
                )}
              </header>

              <div
                ref={scrollRef}
                className="flex-1 space-y-1.5 overflow-y-auto bg-neutral-100/70 px-4 py-5 sm:px-8"
              >
                {timeline.map((item) => {
                  if (item.type === "day") {
                    return (
                      <div key={item.key} className="flex justify-center py-3">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-500 shadow-sm ring-1 ring-neutral-200">
                          {item.label}
                        </span>
                      </div>
                    );
                  }
                  const m = item.m;
                  if (m.sender === "system" || m.sender === "notice") {
                    return (
                      <p
                        key={m.id}
                        className="py-2 text-center text-xs text-neutral-500"
                      >
                        {m.body}
                      </p>
                    );
                  }
                  const mine = m.sender === "admin";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[70%] ${
                          mine
                            ? "rounded-br-md bg-emerald-800 text-white"
                            : "rounded-bl-md border border-neutral-200 bg-white text-neutral-900 shadow-sm"
                        }`}
                      >
                        {m.body}
                      </div>
                      <span className="mt-1 px-1 text-[11px] text-neutral-500">
                        {mine ? "You · " : ""}
                        {clock(m.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {selected.status === "closed" ? (
                <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm text-neutral-500">
                  This chat is closed. Replying will reopen it.
                </div>
              ) : null}

              <div className="flex items-end gap-2 border-t border-neutral-200 bg-white p-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  rows={1}
                  maxLength={1000}
                  placeholder="Write a reply. Enter to send, Shift+Enter for a new line."
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-[15px] text-neutral-900 caret-emerald-700 placeholder-neutral-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
                <button
                  onClick={sendReply}
                  disabled={!input.trim() || isSending}
                  aria-label="Send reply"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-white transition hover:bg-emerald-900 disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
