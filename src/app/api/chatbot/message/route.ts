// File: app/api/chatbot/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-url";
import { forwardJson } from "@/lib/forward-json";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${getApiUrl()}/api/chatbot/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ message: body?.message }),
    });
    return await forwardJson(res);
  } catch (error) {
    console.error("POST /api/chatbot/message error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
