// File: app/api/chat/[token]/messages/route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/lib/proxy";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return proxy(`/api/chat/${encodeURIComponent(token)}/messages`, {
    method: "POST",
    body: await request.json(),
  });
}
