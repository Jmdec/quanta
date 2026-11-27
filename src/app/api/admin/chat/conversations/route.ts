// File: app/api/admin/chat/conversations/route.ts
import { proxy } from "@/lib/proxy";

export async function GET() {
  return proxy("/api/admin/chat/conversations", { auth: true });
}
