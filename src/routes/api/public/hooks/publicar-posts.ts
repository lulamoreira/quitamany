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
    if (code === "FINISHED" || code === "PUBLISHED") {
      let mediaId = p.media_id as string | null;
      // Só publica se ainda não foi publicado (FINISHED = pronto para publicar)
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
        mediaId = pubBody.id;
      }
      // Busca permalink
      let permalink: string | null = null;
      if (mediaId) {
        const linkResp = await fetch(
          `${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(cfg.access_token)}`,
        );
        const linkBody: any = await linkResp.json();
        permalink = linkBody.permalink || null;
      }
      await supabaseAdmin
        .from("posts_agendados")
        .update({
          status: "publicado",
          media_id: mediaId,
          permalink,
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
    // IN_PROGRESS: deixa para próxima rodada
  }
  return { publicados, tokenExpired };
}

export async function executarMotorPublicacao() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin.from("ig_config").select("*").limit(1).maybeSingle();
  if (!cfg) {
    const result = { ok: false as const, msg: "Sem configuração Meta" };
    return result;
  }
  const a = await faseA(supabaseAdmin, cfg);
  const b = await faseB(supabaseAdmin, cfg);
  const result = { ok: true as const, a, b, executado_em: new Date().toISOString() };
  await supabaseAdmin
    .from("ig_config")
    .update({
      ultima_execucao_motor: result.executado_em,
      ultima_execucao_resultado: result as any,
    })
    .eq("id", (cfg as any).id);
  return result;
}

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
        const result = await executarMotorPublicacao();
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
