import { createFileRoute } from "@tanstack/react-router";
import { executarMotor } from "@/lib/motor-publicacao.server";

export const Route = createFileRoute("/api/public/hooks/publicar-posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const header = request.headers.get("x-cron-secret");
        if (!secret || header !== secret) {
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const result = await executarMotor();
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
