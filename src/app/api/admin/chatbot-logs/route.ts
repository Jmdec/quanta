// File: app/api/admin/chatbot-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-url";
import { authHeaders } from "@/lib/auth-headers";
import { forwardJson } from "@/lib/forward-json";

export async function GET() {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${getApiUrl()}/api/admin/chatbot-logs`, {
      headers: { Accept: "application/json", ...headers },
      cache: "no-store",
    });
    return await forwardJson(res);
  } catch (error) {
    console.error("GET /api/admin/chatbot-logs error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const headers = await authHeaders();
    const message = request.nextUrl.searchParams.get("message") ?? "";
    const res = await fetch(
      `${getApiUrl()}/api/admin/chatbot-logs?message=${encodeURIComponent(message)}`,
      { method: "DELETE", headers: { Accept: "application/json", ...headers } },
    );
    return await forwardJson(res);
  } catch (error) {
    console.error("DELETE /api/admin/chatbot-logs error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
