// File: components/admin/chatbot-response-form-dialog.tsx
"use client";

import { useState } from "react";
import {
  ChatbotResponse,
  ChatbotResponseFormValues,
  ChatbotResponseType,
} from "@/types/chatbot";

interface Props {
  open: boolean;
  /** Existing item (has id) to edit, a partial prefill for a new item, or null. */
  initialData: Partial<ChatbotResponse> | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ChatbotResponseFormValues) => void | Promise<void>;
}

export function ChatbotResponseFormDialog(props: Props) {
  if (!props.open) return null;
  // Mounted only while open, so state re-initialises from initialData each time.
  return <Form {...props} />;
}

const lines = (v: string) =>
  v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

function Form({ initialData, isSubmitting, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [type, setType] = useState<ChatbotResponseType>(
    initialData?.type ?? "answer",
  );
  const [keywords, setKeywords] = useState(
    (initialData?.keywords ?? []).join(", "),
  );
  const [response, setResponse] = useState(initialData?.response ?? "");
  const [suggestions, setSuggestions] = useState(
    (initialData?.suggestions ?? []).join("\n"),
  );
  const [sortOrder, setSortOrder] = useState(initialData?.sort_order ?? 0);
  const [isMenu, setIsMenu] = useState(initialData?.is_menu ?? false);
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

  const isEditing = Boolean(initialData?.id);
  const isAnswer = type === "answer";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title: title.trim(),
      type,
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      response,
      suggestions: lines(suggestions),
      sort_order: Number(sortOrder) || 0,
      is_menu: isAnswer ? isMenu : false,
      is_active: isActive,
    });
  }

  const input =
    "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10";
  const label = "block text-sm font-medium text-gray-700";
  const hint = "mt-1 text-xs text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit chatbot response" : "New chatbot response"}
          </h2>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={label}>Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={input}
                placeholder="e.g. Careers"
              />
              <p className={hint}>
                Also the chip label and an exact-match phrase.
              </p>
            </div>
            <div>
              <label className={label}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ChatbotResponseType)}
                className={input}
              >
                <option value="answer">Answer</option>
                <option value="welcome">Welcome</option>
                <option value="fallback">Fallback</option>
              </select>
            </div>
          </div>

          {isAnswer && (
            <div>
              <label className={label}>Keywords</label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className={input}
                placeholder="career, job, hiring, apply"
              />
              <p className={hint}>
                Comma-separated. Longer keywords score higher than short ones.
              </p>
            </div>
          )}

          <div>
            <label className={label}>Response</label>
            <textarea
              required
              rows={8}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className={`${input} font-mono`}
            />
            <p className={hint}>
              Supports **bold** and [label](https://url) links. New lines are
              kept.
            </p>
          </div>

          {isAnswer && (
            <div>
              <label className={label}>Follow-up chips</label>
              <textarea
                rows={3}
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                className={input}
                placeholder={"Contact us\nAbout Quanta Paper"}
              />
              <p className={hint}>
                One per line. Use the exact title of another answer so the chip
                opens it.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="w-28">
              <label className={label}>Order</label>
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className={input}
              />
            </div>
            {isAnswer && (
              <label className="flex items-center gap-2 pt-5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isMenu}
                  onChange={(e) => setIsMenu(e.target.checked)}
                />
                Show on main menu
              </label>
            )}
            <label className="flex items-center gap-2 pt-5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Published
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
