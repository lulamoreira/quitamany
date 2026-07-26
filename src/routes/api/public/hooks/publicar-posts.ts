import { createFileRoute } from "@tanstack/react-router";

const GRAPH = "https://graph.facebook.com/v21.0";

async function faseA(supabaseAdmin: any, cfg: any) {
  const { data: posts } = await supabaseAdmin
    .from("posts_agendados")
    .select("*")
    .eq("status", "agendado")
    .lte("agendado_para", new Date().toISOString())
    .limit(10);

  if (!posts?.length) return { processados: 0 };
  let tokenExpired = false;
  for (const p of posts) {
    if (tokenExpired) break;
    if (!p.video_url) {
      await supabaseAdmin
        .from("posts_agendados")
        .update({ status: "erro", erro_msg: "Vídeo ausente" })
        .eq("id", p.id);
      continue;
    }
    const caption = (p.legenda || "") + (p.hashtags ? "\n.\n" + p.hashtags : "");
    const params = new URLSearchParams({
      media_type: "REELS",
      video_url: p.video_url,
      caption,
      share_to_feed: "true",
      access_token: cfg.access_token,
    });
    const resp = await fetch(`${GRAPH}/${cfg.ig_user_id}/media?${params}`, { method: "POST" });
    const body: any = await resp.json();
    if (body.error?.code === 190) {
      tokenExpired = true;
      await supabaseAdmin
        .from("posts_agendados")
        .update({ status: "erro", erro_msg: "Token expirado" })
        .eq("id", p.id);
      break;
    }
    if (!resp.ok || body.error) {
      await supabaseAdmin
        .from("posts_agendados")
        .update({ status: "erro", erro_msg: body.error?.message || "Falha ao criar container" })
        .eq("id", p.id);
      continue;
    }
    await supabaseAdmin
      .from("posts_agendados")
      .update({ status: "processando", container_id: body.id })
      .eq("id", p.id);
  }
  return { processados: posts.length, tokenExpired };
}

async function faseB(supabaseAdmin: any, cfg: any) {
  const { data: posts } = await supabaseAdmin
    .from("posts_agendados")
    .select("*")
    .eq("status", "processando")
    .not("container_id", "is", null)
    .limit(10);
  if (!posts?.length) return { publicados: 0 };
  let tokenExpired = false;
  let publicados = 0;
  for (const p of posts) {
    if (tokenExpired) break;
    const statusResp = await fetch(
      `${GRAPH}/${p.container_id}?fields=status_code&access_token=${encodeURIComponent(cfg.access_token)}`,
    );
    const statusBody: any = await statusResp.json();
    if (statusBody.error?.code === 190) {
      tokenExpired = true;
      break;
    }
    const code = statusBody.status_code;
    if (code === "FINISHED") {
      const pubResp = await fetch(
        `${GRAPH}/${cfg.ig_user_id}/media_publish?creation_id=${p.container_id}&access_token=${encodeURIComponent(cfg.access_token)}`,
        { method: "POST" },
      );
      const pubBody: any = await pubResp.json();
      if (!pubResp.ok || pubBody.error) {
        await supabaseAdmin
          .from("posts_agendados")
          .update({ status: "erro", erro_msg: pubBody.error?.message || "Falha ao publicar" })
          .eq("id", p.id);
        continue;
      }
      // permalink
      const linkResp = await fetch(
        `${GRAPH}/${pubBody.id}?fields=permalink&access_token=${encodeURIComponent(cfg.access_token)}`,
      );
      const linkBody: any = await linkResp.json();
      await supabaseAdmin
        .from("posts_agendados")
        .update({
          status: "publicado",
          media_id: pubBody.id,
          permalink: linkBody.permalink || null,
          publicado_em: new Date().toISOString(),
        })
        .eq("id", p.id);
      publicados++;
    } else if (code === "ERROR") {
      await supabaseAdmin
        .from("posts_agendados")
        .update({ status: "erro", erro_msg: "Instagram rejeitou o vídeo" })
        .eq("id", p.id);
    }
    // caso IN_PROGRESS/PUBLISHED, deixa para próxima rodada
  }
  return { publicados, tokenExpired };
}

export const Route = createFileRoute("/api/public/hooks/publicar-posts")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin.from("ig_config").select("*").limit(1).single();
        if (!cfg) {
          return new Response(JSON.stringify({ ok: false, msg: "Sem configuração Meta" }), {
            headers: { "content-type": "application/json" },
          });
        }
        const a = await faseA(supabaseAdmin, cfg);
        const b = await faseB(supabaseAdmin, cfg);
        return new Response(JSON.stringify({ ok: true, a, b }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
