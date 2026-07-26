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

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1) Gravar SEMPRE o evento bruto recebido (auditoria)
          const insertedIds: string[] = [];
          if (eventoIds.length > 0) {
            // Deduplicação: verifica quais já existem
            const { data: existentes } = await (supabaseAdmin as any)
              .from("eventos_webhook")
              .select("evento_id")
              .in("evento_id", eventoIds);
            const jaVistos = new Set((existentes ?? []).map((e: any) => e.evento_id));
            const novosIds = eventoIds.filter((id) => !jaVistos.has(id));

            if (novosIds.length === 0) {
              // tudo duplicado: nada a processar
              return new Response("EVENT_RECEIVED", { status: 200 });
            }

            const linhas = novosIds.map((id) => ({
              tipo: "webhook_recebido",
              evento_id: id,
              payload: body as any,
              processado: false,
            }));
            const { data: inseridos, error: insErr } = await (supabaseAdmin as any)
              .from("eventos_webhook")
              .insert(linhas)
              .select("id, evento_id");
            if (insErr) {
              if ((insErr as any).code === "23505") {
                // Outra instância pegou os mesmos ids
                return new Response("EVENT_RECEIVED", { status: 200 });
              }
              // grava um evento de erro genérico e retorna 200
              await (supabaseAdmin as any).from("eventos_webhook").insert({
                tipo: "erro_insert",
                payload: body as any,
                processado: false,
                erro: (insErr as any).message ?? String(insErr),
              });
              return new Response("EVENT_RECEIVED", { status: 200 });
            }
            for (const r of inseridos ?? []) insertedIds.push(r.id);
          } else {
            // Sem evento_id extraível: apenas registra o payload bruto
            await (supabaseAdmin as any).from("eventos_webhook").insert({
              tipo: "webhook_recebido",
              payload: body as any,
              processado: false,
            });
          }

          // 2) Processar com await (serverless encerra após a resposta)
          try {
            const { processarWebhook } = await import("@/lib/quitamany-motor.server");
            await processarWebhook(body);

            // 3) Marcar como processado
            if (insertedIds.length > 0) {
              await (supabaseAdmin as any)
                .from("eventos_webhook")
                .update({ processado: true })
                .in("id", insertedIds);
            }
          } catch (procErr: any) {
            const msg = procErr?.message ?? String(procErr);
            console.error("[webhook-instagram processar]", procErr);
            if (insertedIds.length > 0) {
              await (supabaseAdmin as any)
                .from("eventos_webhook")
                .update({ processado: false, erro: msg })
                .in("id", insertedIds);
            } else {
              await (supabaseAdmin as any).from("eventos_webhook").insert({
                tipo: "erro_processamento",
                payload: body as any,
                processado: false,
                erro: msg,
              });
            }
          }
        } catch (e) {
          console.error("[webhook-instagram]", e);
        }

        // Sempre 200 para a Meta não reenviar
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
