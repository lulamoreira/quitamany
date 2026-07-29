// Server-only motor de publicação. Não importar do cliente.
import { GRAPH } from "@/lib/graph";
import { registrarTentativa } from "@/lib/tentativas.server";

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
      await registrarTentativa(supabaseAdmin, {
        postId: p.id,
        evento: "falha",
        etapa: "criar_container",
        mensagem: "Vídeo ausente",
      });
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
      await registrarTentativa(supabaseAdmin, {
        postId: p.id,
        evento: "falha",
        etapa: "criar_container",
        mensagem: "Token da Meta expirado",
        detalhe: { code: 190, error: body.error ?? null },
      });
      break;
    }
    if (!resp.ok || body.error) {
      await supabaseAdmin
        .from("posts_agendados")
        .update({ status: "erro", erro_msg: body.error?.message || "Falha ao criar container" })
        .eq("id", p.id);
      await registrarTentativa(supabaseAdmin, {
        postId: p.id,
        evento: "falha",
        etapa: "criar_container",
        mensagem: body.error?.message || "Falha ao criar container",
        detalhe: { status: resp.status, error: body.error ?? null },
      });
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
          await registrarTentativa(supabaseAdmin, {
            postId: p.id,
            evento: "falha",
            etapa: "publicar",
            mensagem: pubBody.error?.message || "Falha ao publicar",
            detalhe: { status: pubResp.status, error: pubBody.error ?? null, container_id: p.container_id },
          });
          continue;
        }
        mediaId = pubBody.id;
      }
      let permalink: string | null = null;
      if (mediaId) {
        try {
          const linkResp = await fetch(
            `${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(cfg.access_token)}`,
          );
          const linkBody: any = await linkResp.json();
          if (linkResp.ok && !linkBody.error) {
            permalink = linkBody.permalink || null;
          } else {
            console.error("Falha ao buscar permalink (publicação já concluída):", linkBody.error);
          }
        } catch (e) {
          console.error("Erro ao buscar permalink (publicação já concluída):", e);
        }
      }
      await supabaseAdmin
        .from("posts_agendados")
        .update({
          status: "publicado",
          media_id: mediaId,
          permalink,
          instagram_media_id: mediaId,
          instagram_permalink: permalink,
          publicado_em: new Date().toISOString(),
        })
        .eq("id", p.id);
      await registrarTentativa(supabaseAdmin, {
        postId: p.id,
        evento: "publicado",
        etapa: "publicar",
        mensagem: "Publicado no Instagram",
        detalhe: { media_id: mediaId, permalink },
      });
      publicados++;
    } else if (code === "ERROR") {
      await supabaseAdmin
        .from("posts_agendados")
        .update({ status: "erro", erro_msg: "Instagram rejeitou o vídeo" })
        .eq("id", p.id);
      await registrarTentativa(supabaseAdmin, {
        postId: p.id,
        evento: "falha",
        etapa: "processamento",
        mensagem: "Instagram rejeitou o vídeo",
        detalhe: { status_code: code, container_id: p.container_id },
      });
    }
  }
  return { publicados, tokenExpired };
}

export async function executarMotor() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin.from("ig_config").select("*").limit(1).maybeSingle();
  if (!cfg) return { ok: false as const, error: "Sem configuração Meta" };
  const a = await faseA(supabaseAdmin, cfg);
  const b = await faseB(supabaseAdmin, cfg);
  const executado_em = new Date().toISOString();
  const result = { ok: true as const, a, b, executado_em };
  await supabaseAdmin
    .from("ig_config")
    .update({
      ultima_execucao_motor: executado_em,
      ultima_execucao_resultado: result as any,
    })
    .eq("id", (cfg as any).id);
  return result;
}
