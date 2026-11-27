// File: app/api/broadcasting/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-url";
import { authHeaders } from "@/lib/auth-headers";

// Echo POSTs form-encoded { socket_id, channel_name } here; we forward it to Laravel
// with the admin's auth headers and hand Laravel's signed response back to Echo.
export async function POST(request: NextRequest) {
  try {
    const headers = await authHeaders();
    const body = await request.text();
    const res = await fetch(`${getApiUrl()}/api/broadcasting/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        ...headers,
      },
      body,
    });
    const raw = await res.text();
    return new NextResponse(raw, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("POST /api/broadcasting/auth error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
