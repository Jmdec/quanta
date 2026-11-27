// File: app/api/chat/start/route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  return proxy("/api/chat/start", {
    method: "POST",
    body: await request.json(),
  });
}
