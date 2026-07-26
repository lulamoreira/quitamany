import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/webhook-instagram")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.WEBHOOK_VERIFY_TOKEN;
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200, headers: { "content-type": "text/plain" } });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        let body: any = null;
        try {
          body = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        try {
          const { processarWebhook } = await import("@/lib/quitamany-motor.server");
          await processarWebhook(body);
        } catch (e) {
          console.error("[webhook-instagram]", e);
        }
        // Meta espera 200 rápido; erros ficam no eventos_webhook
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
