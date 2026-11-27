// File: app/api/chatbot/welcome/route.ts
import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-url";
import { forwardJson } from "@/lib/forward-json";

export async function GET() {
  try {
    const res = await fetch(`${getApiUrl()}/api/chatbot/welcome`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return await forwardJson(res);
  } catch (error) {
    console.error("GET /api/chatbot/welcome error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
