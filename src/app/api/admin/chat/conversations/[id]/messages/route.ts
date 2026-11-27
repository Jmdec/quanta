// File: app/api/admin/chat/conversations/[id]/messages/route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/lib/proxy";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return proxy(`/api/admin/chat/conversations/${id}/messages`, {
    method: "POST",
    auth: true,
    body: await request.json(),
  });
}
