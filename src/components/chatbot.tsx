"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, HeadphonesIcon, Clock, MessageSquare } from "lucide-react";
import { ChatPayload } from "@/types/live-chat";

type SenderType = "user" | "bot";
type Message = {
  id: string;
  text: string;
  sender: SenderType;
  suggestions?: string[];
};
type BotReply = { text: string; suggestions: string[] };
type LiveStep = "idle" | "askName" | "askConcern" | "live";

const HOURS = "Mon–Sun 9AM–6PM";
const BACK_CHIP = "← Back to main menu";
const LIVE_CHIP = "💬 Talk to a person";
const BOT_CHIP = "🤖 Back to assistant";
const POLL_MS = 3000;
const TOKEN_KEY = "quanta_live_chat_token";
const OFFLINE_REPLY =
  "⚠️ Sorry, I can't reach our server right now. Please try again in a moment or email **wecare@quantapaper.com**.";

const withBack = (s: string[]) =>
  s.includes(BACK_CHIP) ? s : [...s, BACK_CHIP];
const withLive = (s: string[]) =>
  s.includes(LIVE_CHIP) ? s : [...s, LIVE_CHIP];

async function fetchWelcome(): Promise<BotReply> {
  const res = await fetch("/api/chatbot/welcome", { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed");
  return json.data;
}

async function fetchReply(message: string): Promise<BotReply> {
  const res = await fetch("/api/chatbot/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed");
  return json.data;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed");
  return json.data;
}

/** Renders **bold** and [label](url) markdown inline. */
function FormatText({ text }: { text: string }) {
  const tokenRe = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

  return (
    <>
      {text.split("\n").map((line, i, arr) => (
        <span key={i}>
          {line.split(tokenRe).map((seg, j) => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
              return <strong key={j}>{seg.slice(2, -2)}</strong>;
            }
            const linkMatch = seg.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (linkMatch) {
              const [, label, url] = linkMatch;
              const safe = /^(https?:\/\/|\/|mailto:)/i.test(url);
              return safe ? (
                <a
                  key={j}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 underline underline-offset-2 hover:text-green-800 font-medium"
                >
                  {label}
                </a>
              ) : (
                label
              );
            }
            return seg;
          })}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveStep, setLiveStep] = useState<LiveStep>("idle");
  const [liveToken, setLiveToken] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const welcomeRequested = useRef(false);
  const menuRef = useRef<string[]>([]);
  const isOpenRef = useRef(false);
  const seenRef = useRef<Set<number>>(new Set()); // server message ids already shown (dedupe)

  const nextId = (prefix: string) => `${prefix}-${++idRef.current}`;

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function addMsg(text: string, sender: SenderType, suggestions?: string[]) {
    setMessages((prev) => [
      ...prev,
      { id: nextId(sender), text, sender, suggestions },
    ]);
  }

  /** Show a message that came from the server (REST response, history or WebSocket). */
  function showServerMessage(m: ChatPayload) {
    if (seenRef.current.has(m.id)) return;
    seenRef.current.add(m.id);
    if (m.sender === "notice") return; // admin-only, never show to the customer
    const fromCustomer = m.sender === "customer";
    addMsg(m.body, fromCustomer ? "user" : "bot");
    if (!fromCustomer && !isOpenRef.current) setUnreadCount((n) => n + 1);
  }

  // Resume an existing live chat after a page reload.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/${token}`, { cache: "no-store" });
        const json = await res.json();
        if (ignore) return;
        if (!res.ok || !json.success || json.data.status === "closed") {
          localStorage.removeItem(TOKEN_KEY);
          return;
        }
        welcomeRequested.current = true; // skip the bot welcome, we have history
        (json.data.messages as ChatPayload[]).forEach(showServerMessage);
        setLiveToken(token);
        setLiveStep("live");
      } catch {
        /* stay in bot mode */
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling: new agent messages (and "chat closed") arrive within a few seconds.
  useEffect(() => {
    if (!liveToken) return;
    let stop = false;
    let busy = false;

    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const res = await fetch(`/api/chat/${liveToken}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (stop || !res.ok || !json.success) return;
        (json.data.messages as ChatPayload[]).forEach(showServerMessage);
        if (json.data.status === "closed") endLive(false);
      } catch {
        /* try again on the next tick */
      } finally {
        busy = false;
      }
    };

    const t = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveToken]);

  // Bot welcome, loaded from Laravel the first time the chat opens.
  useEffect(() => {
    if (!isOpen || welcomeRequested.current) return;
    welcomeRequested.current = true;
    setIsTyping(true);
    fetchWelcome()
      .then((w) => {
        menuRef.current = withLive(w.suggestions);
        addMsg(w.text, "bot", menuRef.current);
      })
      .catch(() => {
        welcomeRequested.current = false;
        addMsg(OFFLINE_REPLY, "bot", []);
      })
      .finally(() => setIsTyping(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function endLive(announce = true) {
    localStorage.removeItem(TOKEN_KEY);
    setLiveToken(null);
    setLiveStep("idle");
    setPendingName("");
    seenRef.current = new Set();
    if (announce)
      addMsg("You're back with our assistant. 😊", "bot", menuRef.current);
  }

  async function startLive(name: string, concern: string) {
    const data = await postJson("/api/chat/start", { name, concern });
    localStorage.setItem(TOKEN_KEY, data.token);
    seenRef.current = new Set();
    if (data.message_id) seenRef.current.add(data.message_id); // concern already shown locally
    setLiveToken(data.token);
    setLiveStep("live");
    addMsg(
      `✅ You're connected, ${name}! A team member will reply right here. (${HOURS})`,
      "bot",
      [BOT_CHIP],
    );
  }

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || isTyping) return;

    // ── Live chat: ask name
    if (liveStep === "askName") {
      const name = text.slice(0, 100);
      setInput("");
      addMsg(text, "user");
      setPendingName(name);
      addMsg(`Thanks, ${name}! 😊 What can we help you with today?`, "bot");
      setLiveStep("askConcern");
      return;
    }

    // ── Live chat: ask concern, then start the chat with it as the first message
    if (liveStep === "askConcern") {
      setInput("");
      addMsg(text, "user");
      setIsTyping(true);
      try {
        await startLive(pendingName, text.slice(0, 1000));
      } catch {
        setLiveStep("idle");
        setPendingName("");
        addMsg(OFFLINE_REPLY, "bot", menuRef.current);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    // ── Live chat: talking to a person
    if (liveStep === "live" && liveToken) {
      if (text === BOT_CHIP) {
        addMsg(text, "user");
        endLive();
        return;
      }
      setInput("");
      try {
        const msg: ChatPayload = await postJson(
          `/api/chat/${liveToken}/messages`,
          { body: text },
        );
        showServerMessage(msg); // WebSocket echo of the same id is ignored
      } catch {
        addMsg("⚠️ Your message couldn't be sent. Please try again.", "bot");
      }
      return;
    }

    // ── Start live chat
    if (text === LIVE_CHIP) {
      addMsg(text, "user");
      addMsg("Happy to connect you with our team 😊 What's your name?", "bot");
      setLiveStep("askName");
      return;
    }

    // ── Bot mode
    setInput("");
    addMsg(text, "user");
    setIsTyping(true);
    try {
      if (text === BACK_CHIP) {
        const w = await fetchWelcome();
        menuRef.current = withLive(w.suggestions);
        addMsg("What else can I help you with? 😊", "bot", menuRef.current);
      } else {
        const reply = await fetchReply(text);
        addMsg(reply.text, "bot", withBack(reply.suggestions));
      }
    } catch {
      addMsg(OFFLINE_REPLY, "bot", menuRef.current);
    } finally {
      setIsTyping(false);
    }
  }

  const isLive = liveStep === "live";

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {isOpen && (
        <div
          className="absolute bottom-20 right-0 w-80 sm:w-96 flex flex-col shadow-2xl shadow-black/20 rounded-2xl overflow-hidden border border-neutral-200 bg-white"
          style={{ height: "540px", animation: "chatFadeUp 0.2s ease" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-green-700 to-green-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-white/20">
                <HeadphonesIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight tracking-tight">
                  Quanta Paper Corporation
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-lime-300" />
                  <p className="text-green-50/90 text-xs">
                    {isLive ? "Live chat with our team" : "AI Assistant"}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub-header */}
          <div className="bg-neutral-50 px-4 py-2 flex items-center justify-between gap-4 flex-shrink-0 border-b border-neutral-200">
            <div className="flex items-center gap-1.5 text-neutral-500 text-xs font-medium">
              <Clock className="w-3 h-3" />
              <span>{HOURS}</span>
            </div>
            {isLive && (
              <button
                onClick={() => endLive()}
                className="text-xs font-medium text-green-700 hover:underline"
              >
                End live chat
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-2 ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-green-600 text-white rounded-br-sm shadow-sm"
                      : "bg-neutral-100 text-neutral-800 rounded-bl-sm border border-neutral-200"
                  }`}
                >
                  <FormatText text={msg.text} />
                </div>

                {msg.sender === "bot" &&
                  msg.suggestions &&
                  msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-w-[90%]">
                      {msg.suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendMessage(s)}
                          disabled={isTyping}
                          className="text-xs px-3 py-1.5 rounded-full border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-start">
                <div className="bg-neutral-100 border border-neutral-200 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <div
                        key={d}
                        className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="bg-white border-t border-neutral-200 p-3 flex-shrink-0">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                maxLength={isLive || liveStep === "askConcern" ? 1000 : 500}
                placeholder={
                  liveStep === "askName"
                    ? "Your name…"
                    : liveStep === "askConcern"
                      ? "Your concern…"
                      : isLive
                        ? "Message our team…"
                        : "Ask about Quanta Paper products…"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15 transition-all"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                aria-label="Send"
                className="w-9 h-9 bg-green-600 hover:bg-green-700 disabled:opacity-30 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-neutral-400 text-xs text-center mt-2">
              Quanta Paper Corporation Inc. · Mandaluyong City, Philippines
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="relative w-14 h-14 rounded-full bg-gradient-to-br -top-1 -right-4 from-green-700 to-green-500 text-white shadow-xl shadow-green-900/25 hover:shadow-green-700/35 hover:scale-105 transition-all duration-300 flex items-center justify-center border border-green-400/30"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageSquare className="w-6 h-6" />
        )}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <style>{`
        @keyframes chatFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
