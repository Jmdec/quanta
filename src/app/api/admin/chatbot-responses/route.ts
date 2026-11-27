// File: app/api/admin/chatbot-responses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-url";
import { authHeaders } from "@/lib/auth-headers";
import { forwardJson } from "@/lib/forward-json";

export async function GET() {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${getApiUrl()}/api/admin/chatbot-responses`, {
      headers: { Accept: "application/json", ...headers },
      cache: "no-store",
    });
    return await forwardJson(res);
  } catch (error) {
    console.error("GET /api/admin/chatbot-responses error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = await authHeaders();
    const body = await request.json();
    const res = await fetch(`${getApiUrl()}/api/admin/chatbot-responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    return await forwardJson(res);
  } catch (error) {
    console.error("POST /api/admin/chatbot-responses error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
