// File: app/api/chat/[token]/route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/lib/proxy";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return proxy(`/api/chat/${encodeURIComponent(token)}`);
}
