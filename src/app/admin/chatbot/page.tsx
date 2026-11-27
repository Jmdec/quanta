// File: app/admin/chatbot/page.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { DataTable, Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ChatbotResponseFormDialog } from "@/components/admin/chatbot-response-form-dialog";
import {
  ApiItemResponse,
  ApiListResponse,
  ChatbotLog,
  ChatbotResponse,
  ChatbotResponseFormValues,
} from "@/types/chatbot";

const PAGE_SIZE = 10;

async function fetchResponses(): Promise<ChatbotResponse[]> {
  const res = await fetch("/api/admin/chatbot-responses", {
    cache: "no-store",
  });
  const json: ApiListResponse<ChatbotResponse> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load responses");
  }
  return json.data;
}

async function fetchLogs(): Promise<ChatbotLog[]> {
  const res = await fetch("/api/admin/chatbot-logs", { cache: "no-store" });
  const json: ApiListResponse<ChatbotLog> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load unanswered questions");
  }
  return json.data;
}

const errMsg = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function AdminChatbotPage() {
  const [tab, setTab] = useState<"responses" | "unanswered">("responses");

  const [responses, setResponses] = useState<ChatbotResponse[]>([]);
  const [logs, setLogs] = useState<ChatbotLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ChatbotResponse> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ChatbotResponse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  async function reload() {
    setIsLoading(true);
    try {
      const [r, l] = await Promise.all([fetchResponses(), fetchLogs()]);
      setResponses(r);
      setLogs(l);
    } catch (err) {
      toast.error(errMsg(err, "Failed to load chatbot data"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [r, l] = await Promise.all([fetchResponses(), fetchLogs()]);
        if (!ignore) {
          setResponses(r);
          setLogs(l);
        }
      } catch (err) {
        if (!ignore) toast.error(errMsg(err, "Failed to load chatbot data"));
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSave(values: ChatbotResponseFormValues) {
    setIsSaving(true);
    try {
      const id = editing?.id;
      const res = await fetch(
        id
          ? `/api/admin/chatbot-responses/${id}`
          : "/api/admin/chatbot-responses",
        {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const json: ApiItemResponse<ChatbotResponse> = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save response");
      }
      toast.success(id ? "Response updated." : "Response created.");
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(errMsg(err, "Failed to save response"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/chatbot-responses/${deleteTarget.id}`,
        {
          method: "DELETE",
        },
      );
      const json = await res.json().catch(() => ({ success: res.ok }));
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to delete response");
      }
      toast.success("Response deleted.");
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      toast.error(errMsg(err, "Failed to delete response"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function dismissLog(message: string) {
    try {
      const res = await fetch(
        `/api/admin/chatbot-logs?message=${encodeURIComponent(message)}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({ success: res.ok }));
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to dismiss");
      }
      setLogs((prev) => prev.filter((l) => l.message !== message));
    } catch (err) {
      toast.error(errMsg(err, "Failed to dismiss"));
    }
  }

  const typeStyles: Record<string, string> = {
    answer: "bg-blue-50 text-blue-700",
    welcome: "bg-violet-50 text-violet-700",
    fallback: "bg-amber-50 text-amber-700",
  };

  const columns: Column<ChatbotResponse>[] = [
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.title}</p>
          <p className="mt-0.5 line-clamp-1 max-w-sm text-xs text-gray-500">
            {r.response.replace(/\*\*/g, "").replace(/\n/g, " ")}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${typeStyles[r.type]}`}
        >
          {r.type}
        </span>
      ),
    },
    {
      key: "keywords",
      header: "Keywords",
      render: (r) => (
        <span className="text-gray-600">
          {r.type === "answer" ? r.keywords.length : "—"}
        </span>
      ),
    },
    {
      key: "sort_order",
      header: "Order",
      render: (r) => <span className="text-gray-600">{r.sort_order}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            r.is_active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {r.is_active ? "Published" : "Draft"}
        </span>
      ),
    },
  ];

  const tabBtn = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${
      active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Chatbot</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage what the website assistant says. Changes go live
              immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            New Response
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            className={tabBtn(tab === "responses")}
            onClick={() => setTab("responses")}
          >
            Responses
          </button>
          <button
            className={tabBtn(tab === "unanswered")}
            onClick={() => setTab("unanswered")}
          >
            Unanswered questions
            {logs.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        <div className="mt-4">
          {tab === "responses" ? (
            <DataTable
              columns={columns}
              data={responses}
              rowKey={(r) => r.id}
              pageSize={PAGE_SIZE}
              isLoading={isLoading}
              emptyMessage="No chatbot responses yet."
              mobileTitle={(r) => r.title}
              renderActions={(r) => (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(r);
                      setFormOpen(true);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    aria-label={`Edit ${r.title}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(r)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${r.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            />
          ) : (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {logs.length === 0 && (
                <p className="p-6 text-center text-sm text-gray-500">
                  {isLoading
                    ? "Loading…"
                    : "Nothing here — the bot answered everything. 🎉"}
                </p>
              )}
              {logs.map((l) => (
                <div
                  key={l.message}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {l.message}
                    </p>
                    <p className="text-xs text-gray-500">
                      Asked {l.total}× · last{" "}
                      {new Date(l.last_asked_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing({
                        title: l.message.slice(0, 150),
                        keywords: [l.message.toLowerCase().slice(0, 100)],
                      });
                      setFormOpen(true);
                    }}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    Create answer
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissLog(l.message)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ChatbotResponseFormDialog
        open={formOpen}
        initialData={editing}
        isSubmitting={isSaving}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.title}"?`}
        description="This action cannot be undone. The chatbot will stop answering this topic."
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
