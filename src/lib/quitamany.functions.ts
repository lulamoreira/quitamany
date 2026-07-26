import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH = "https://graph.facebook.com/v21.0";
const META_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
].join(",");

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores");
}

// Inicia o fluxo OAuth: cria um state anti-CSRF e devolve a URL do diálogo do Facebook
export const iniciarConexaoMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const appId = process.env.META_APP_ID;
    if (!appId) return { ok: false as const, error: "META_APP_ID não configurado" };

    const redirect_uri = `${data.origin.replace(/\/$/, "")}/api/public/meta-callback`;
    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("meta_oauth_states").insert({
      state,
      criado_por: context.userId,
      redirect_uri,
      status: "aguardando",
    });
    if (error) return { ok: false as const, error: error.message };

    const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirect_uri);
    url.searchParams.set("scope", META_OAUTH_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");

    return { ok: true as const, oauth_url: url.toString(), redirect_uri, state };
  });

// Consulta o resultado do fluxo OAuth (o callback grava aqui)
export const obterEstadoMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { state: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("meta_oauth_states")
      .select("*")
      .eq("state", data.state)
      .eq("criado_por", context.userId)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "State inválido ou expirado" };
    return {
      ok: true as const,
      status: row.status as "aguardando" | "escolher_pagina" | "conectado" | "erro",
      erro: row.erro as string | null,
      paginas: (row.paginas ?? null) as any,
    };
  });

// Confirma escolha da Página quando o usuário tem múltiplas
export const escolherPaginaMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { state: string; page_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { finalizarConexaoMeta } = await import("./meta-oauth.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("meta_oauth_states")
      .select("*")
      .eq("state", data.state)
      .eq("criado_por", context.userId)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "State inválido" };
    if (!row.access_token) return { ok: false as const, error: "Token indisponível" };
    const paginas = (row.paginas ?? []) as Array<{ id: string; access_token?: string; name?: string }>;
    const escolhida = paginas.find((p) => p.id === data.page_id);
    if (!escolhida) return { ok: false as const, error: "Página não encontrada na lista" };
    const res = await finalizarConexaoMeta(row.access_token, escolhida, row.redirect_uri);
    await (supabaseAdmin as any)
      .from("meta_oauth_states")
      .update({ status: res.ok ? "conectado" : "erro", erro: res.ok ? null : res.error, consumido_em: new Date().toISOString() })
      .eq("state", data.state);
    return res;
  });



// Envia mensagem manual (humano) a partir do inbox
export const enviarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id: string; texto: string }) => d)
  .handler(async ({ data, context }) => {
    const sb: any = context.supabase;
    const { data: conv } = await sb
      .from("conversas")
      .select("id, contato_id, janela_expira_em")
      .eq("id", data.conversa_id)
      .single();
    if (!conv) return { ok: false as const, error: "Conversa não encontrada" };

    if (conv.janela_expira_em && new Date(conv.janela_expira_em).getTime() < Date.now()) {
      return { ok: false as const, error: "Janela de 24h expirada — aguarde o cliente mandar mensagem" };
    }

    const { data: contato } = await sb.from("contatos").select("ig_id").eq("id", conv.contato_id).single();
    if (!contato) return { ok: false as const, error: "Contato não encontrado" };

    const { data: cfg } = await sb.from("ig_config").select("ig_user_id, access_token").limit(1).maybeSingle();
    if (!cfg) return { ok: false as const, error: "Conexão Meta não configurada" };

    const url = `${GRAPH}/${cfg.ig_user_id}/messages?access_token=${encodeURIComponent(cfg.access_token)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { id: contato.ig_id }, message: { text: data.texto } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (j?.error?.code === 190) return { ok: false as const, error: "Token do Instagram expirado" };
      return { ok: false as const, error: j?.error?.message || "Falha ao enviar" };
    }

    await sb.from("mensagens").insert({
      conversa_id: conv.id,
      direcao: "enviada",
      texto: data.texto,
      enviada_por: "humano",
      payload_bruto: j,
    });
    await sb
      .from("conversas")
      .update({ ultima_mensagem: data.texto, ultima_msg_em: new Date().toISOString(), nao_lidas: 0 })
      .eq("id", conv.id);

    return { ok: true as const };
  });

export const marcarLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id: string }) => d)
  .handler(async ({ data, context }) => {
    const sb: any = context.supabase;
    await sb.from("conversas").update({ nao_lidas: 0 }).eq("id", data.conversa_id);
    return { ok: true as const };
  });

export const alterarModo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id: string; modo: "automatico" | "humano" }) => d)
  .handler(async ({ data, context }) => {
    const sb: any = context.supabase;
    const { error } = await sb.from("conversas").update({ modo: data.modo }).eq("id", data.conversa_id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const obterWebhookInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const token = process.env.WEBHOOK_VERIFY_TOKEN;
    const { data: cfg } = await (context.supabase as any)
      .from("ig_config")
      .select("page_id, ig_user_id, conta_username")
      .limit(1)
      .maybeSingle();
    return {
      ok: true as const,
      verify_token: token ?? "",
      page_id: cfg?.page_id ?? "",
      ig_user_id: cfg?.ig_user_id ?? "",
      conta_username: cfg?.conta_username ?? "",
    };
  });

export const salvarPageId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { page_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: cfg } = await sb.from("ig_config").select("id").limit(1).maybeSingle();
    if (!cfg) return { ok: false as const, error: "Configure a conexão Meta antes." };
    const { error } = await sb.from("ig_config").update({ page_id: data.page_id }).eq("id", cfg.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

const GRAPH_V25 = "https://graph.facebook.com/v25.0";

async function metaFetch(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j };
}

export const configurarWebhookMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callback_url: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb: any = context.supabase;

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
    if (!appId || !appSecret) return { ok: false as const, error: "META_APP_ID/META_APP_SECRET não configurados." };
    if (!verifyToken) return { ok: false as const, error: "WEBHOOK_VERIFY_TOKEN não configurado." };

    const { data: cfg } = await sb.from("ig_config").select("page_id, access_token").limit(1).maybeSingle();
    if (!cfg?.page_id) return { ok: false as const, error: "Preencha o Page ID em Ajustes antes de configurar." };
    if (!cfg?.access_token) return { ok: false as const, error: "Conexão Meta não configurada." };

    const appToken = `${appId}|${appSecret}`;

    // Etapa 1: registrar webhook no app
    const subUrl = new URL(`${GRAPH_V25}/${appId}/subscriptions`);
    subUrl.searchParams.set("object", "instagram");
    subUrl.searchParams.set("callback_url", data.callback_url);
    subUrl.searchParams.set("verify_token", verifyToken);
    subUrl.searchParams.set("fields", "messages,comments");
    subUrl.searchParams.set("access_token", appToken);
    const r1 = await metaFetch(subUrl.toString(), { method: "POST" });
    const etapa1 = r1.ok && (r1.json?.success === true || r1.json?.success === undefined)
      ? { ok: true as const, msg: "Webhook registrado no app (instagram: messages, comments)." }
      : { ok: false as const, msg: r1.json?.error?.message || `Falha (${r1.status})` };

    // Etapa 2: page access token + subscribed_apps
    let etapa2: { ok: boolean; msg: string };
    const tokUrl = `${GRAPH_V25}/${cfg.page_id}?fields=access_token&access_token=${encodeURIComponent(cfg.access_token)}`;
    const rTok = await metaFetch(tokUrl);
    if (!rTok.ok || !rTok.json?.access_token) {
      etapa2 = { ok: false, msg: rTok.json?.error?.message || "Não foi possível obter o page access token." };
    } else {
      const pageToken = rTok.json.access_token as string;
      const subAppUrl = `${GRAPH_V25}/${cfg.page_id}/subscribed_apps?subscribed_fields=messages&access_token=${encodeURIComponent(pageToken)}`;
      const r2 = await metaFetch(subAppUrl, { method: "POST" });
      etapa2 = r2.ok && r2.json?.success !== false
        ? { ok: true, msg: "Página inscrita no app (subscribed_fields: messages)." }
        : { ok: false, msg: r2.json?.error?.message || `Falha (${r2.status})` };
    }

    return { ok: true as const, etapa1, etapa2 };
  });

export const verificarStatusWebhook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb: any = context.supabase;

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return { ok: false as const, error: "META_APP_ID/META_APP_SECRET não configurados." };

    const { data: cfg } = await sb.from("ig_config").select("page_id, access_token").limit(1).maybeSingle();
    const appToken = `${appId}|${appSecret}`;

    const rSub = await metaFetch(`${GRAPH_V25}/${appId}/subscriptions?access_token=${encodeURIComponent(appToken)}`);
    const app_subscriptions = rSub.ok
      ? { ok: true as const, data: rSub.json?.data ?? [] }
      : { ok: false as const, error: rSub.json?.error?.message || `Falha (${rSub.status})` };

    let page_subscribed: any = { ok: false, error: "Page ID não configurado." };
    if (cfg?.page_id && cfg?.access_token) {
      const rTok = await metaFetch(`${GRAPH_V25}/${cfg.page_id}?fields=access_token&access_token=${encodeURIComponent(cfg.access_token)}`);
      if (rTok.ok && rTok.json?.access_token) {
        const rApps = await metaFetch(`${GRAPH_V25}/${cfg.page_id}/subscribed_apps?access_token=${encodeURIComponent(rTok.json.access_token)}`);
        page_subscribed = rApps.ok
          ? { ok: true, data: rApps.json?.data ?? [] }
          : { ok: false, error: rApps.json?.error?.message || `Falha (${rApps.status})` };
      } else {
        page_subscribed = { ok: false, error: rTok.json?.error?.message || "Falha ao obter page token." };
      }
    }

    return { ok: true as const, app_subscriptions, page_subscribed };
  });
