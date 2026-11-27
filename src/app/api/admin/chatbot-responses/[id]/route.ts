// File: app/api/admin/chatbot-responses/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-url";
import { authHeaders } from "@/lib/auth-headers";
import { forwardJson } from "@/lib/forward-json";

// Next.js 15+: params is a Promise. On Next 14, use `{ params }: { params: { id: string } }`.
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const headers = await authHeaders();
    const body = await request.json();
    const res = await fetch(
      `${getApiUrl()}/api/admin/chatbot-responses/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      },
    );
    return await forwardJson(res);
  } catch (error) {
    console.error("PUT /api/admin/chatbot-responses/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const headers = await authHeaders();
    const res = await fetch(
      `${getApiUrl()}/api/admin/chatbot-responses/${id}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json", ...headers },
      },
    );
    return await forwardJson(res);
  } catch (error) {
    console.error("DELETE /api/admin/chatbot-responses/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
