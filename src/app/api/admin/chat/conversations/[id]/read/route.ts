// File: app/api/admin/chat/conversations/[id]/read/route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/lib/proxy";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return proxy(`/api/admin/chat/conversations/${id}/read`, {
    method: "POST",
    auth: true,
  });
}
