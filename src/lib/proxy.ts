// File: lib/proxy.ts
import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-url";
import { authHeaders } from "@/lib/auth-headers";
import { forwardJson } from "@/lib/forward-json";

/** Small helper so each proxy route is a few lines. Pass auth:true for admin routes. */
export async function proxy(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
) {
  try {
    const auth = opts.auth ? await authHeaders() : {};
    const hasBody = opts.body !== undefined;
    const res = await fetch(`${getApiUrl()}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(hasBody && { "Content-Type": "application/json" }),
        ...auth,
      },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    return await forwardJson(res);
  } catch (error) {
    console.error(`proxy ${opts.method ?? "GET"} ${path} error:`, error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
