import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/renovar-tokens")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!secret || provided !== secret) return new Response("forbidden", { status: 403 });
        const { renovarTodosTokens } = await import("@/lib/meta-oauth.server");
        const r = await renovarTodosTokens();
        return Response.json(r);
      },
    },
  },
});
