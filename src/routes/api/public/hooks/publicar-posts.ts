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

        // Verificação de posts removidos no Instagram: acessória ao motor.
        // Nunca pode derrubar a publicação, então roda isolada.
        let verificacao: unknown = null;
        try {
          const { verificarPublicados } = await import("@/lib/verificar-publicados.server");
          verificacao = await verificarPublicados();
        } catch (e) {
          verificacao = { erro: e instanceof Error ? e.message : "falha na verificação" };
        }

        return new Response(JSON.stringify({ ...result, verificacao }), {
          headers: { "content-type": "application/json" },
        });

      },
    },
  },
});
