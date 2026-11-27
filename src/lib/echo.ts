// File: lib/echo.ts
"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js"; // protocol client only — you talk to YOUR Reverb server, not Pusher's service

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

let echo: Echo<"reverb"> | null = null;

export function getEcho(): Echo<"reverb"> {
  if (echo) return echo;

  window.Pusher = Pusher;
  const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http";
  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080);

  echo = new Echo({
    broadcaster: "reverb",
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY!,
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST!,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === "https",
    enabledTransports: ["ws", "wss"],
    authEndpoint: "/api/broadcasting/auth",
  });
  return echo;
}
