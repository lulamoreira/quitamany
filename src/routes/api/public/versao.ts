import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/versao")({
  server: {
    handlers: {
      GET: async () => Response.json({ build: "2026-07-29-mobile-conversa" }),
    },
  },
});
