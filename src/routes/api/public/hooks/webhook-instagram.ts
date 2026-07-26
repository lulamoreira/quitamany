import { createFileRoute } from "@tanstack/react-router";

function extrairEventoIds(body: any): string[] {
  const ids: string[] = [];
  const entries = body?.entry ?? [];
  for (const entry of entries) {
    for (const m of entry.messaging ?? []) {
      const mid = m?.message?.mid;
      if (mid) ids.push(`dm:${mid}`);
    }
    for (const ch of entry.changes ?? []) {
      if (ch?.field === "comments" && ch?.value?.id) {
        ids.push(`cmt:${ch.value.id}`);
      }
    }
  }
  return ids;
}

async function processarAsync(body: any, eventoIds: string[]) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Deduplicação: filtra ids já processados
    let novosIds = eventoIds;
    if (eventoIds.length > 0) {
      const { data: existentes } = await (supabaseAdmin as any)
        .from("eventos_webhook")
        .select("evento_id")
        .in("evento_id", eventoIds);
      const jaVistos = new Set((existentes ?? []).map((e: any) => e.evento_id));
      novosIds = eventoIds.filter((id) => !jaVistos.has(id));
      if (novosIds.length === 0) {
        return; // tudo duplicado, ignora
      }
    }

    // Reserva os ids para evitar corrida entre reentregas simultâneas
    if (novosIds.length > 0) {
      const linhas = novosIds.map((id) => ({
        tipo: "webhook_recebido",
        evento_id: id,
        payload: null,
        processado: false,
      }));
      const { error: insErr } = await (supabaseAdmin as any)
        .from("eventos_webhook")
        .insert(linhas);
      if (insErr) {
        // conflito de índice único → outra instância pegou; sai
        if ((insErr as any).code === "23505") return;
      }
    }

    const { processarWebhook } = await import("@/lib/quitamany-motor.server");
    await processarWebhook(body);
  } catch (e) {
    console.error("[webhook-instagram async]", e);
  }
}

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
        const eventoIds = extrairEventoIds(body);
        // Processa em background — responde 200 imediatamente para a Meta
        // não reenviar por timeout.
        void processarAsync(body, eventoIds);
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
