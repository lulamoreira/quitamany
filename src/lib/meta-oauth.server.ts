// Server-only: lógica compartilhada entre o callback OAuth e a escolha manual de página.
// NÃO importar de rotas do cliente diretamente.

import { GRAPH } from "@/lib/graph";

type Pagina = { id: string; access_token?: string; name?: string; instagram_business_account?: { id: string } };

async function jfetch(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const j: any = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j };
}

// Registra webhook do app + inscreve a página. Retorna resultado por etapa.
export async function configurarWebhookServerSide(pageId: string, pageAccessToken: string, callbackUrl: string) {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN!;
  const appToken = `${appId}|${appSecret}`;

  const subUrl = new URL(`${GRAPH_V25}/${appId}/subscriptions`);
  subUrl.searchParams.set("object", "instagram");
  subUrl.searchParams.set("callback_url", callbackUrl);
  subUrl.searchParams.set("verify_token", verifyToken);
  subUrl.searchParams.set("fields", "messages,comments");
  subUrl.searchParams.set("access_token", appToken);
  const r1 = await jfetch(subUrl.toString(), { method: "POST" });
  const etapa1 = r1.ok
    ? { ok: true, msg: "Webhook registrado no app" }
    : { ok: false, msg: r1.json?.error?.message || `Falha (${r1.status})` };

  const r2 = await jfetch(
    `${GRAPH_V25}/${pageId}/subscribed_apps?subscribed_fields=messages,comments&access_token=${encodeURIComponent(pageAccessToken)}`,
    { method: "POST" },
  );
  const etapa2 = r2.ok
    ? { ok: true, msg: "Página inscrita no app (subscribed_fields: messages, comments)." }
    : { ok: false, msg: r2.json?.error?.message || `Falha (${r2.status})` };

  return { etapa1, etapa2 };
}

// Troca code por token curto → longo, e busca /me/accounts
export async function trocarCodePorTokenLongo(code: string, redirect_uri: string) {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;

  const shortUrl = new URL(`${GRAPH_V25}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", appId);
  shortUrl.searchParams.set("client_secret", appSecret);
  shortUrl.searchParams.set("redirect_uri", redirect_uri);
  shortUrl.searchParams.set("code", code);
  const rShort = await jfetch(shortUrl.toString());
  if (!rShort.ok || !rShort.json?.access_token) {
    return { ok: false as const, error: rShort.json?.error?.message || "Falha ao trocar code por token" };
  }
  const shortToken = rShort.json.access_token as string;

  const longUrl = new URL(`${GRAPH_V25}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("fb_exchange_token", shortToken);
  const rLong = await jfetch(longUrl.toString());
  if (!rLong.ok || !rLong.json?.access_token) {
    return { ok: false as const, error: rLong.json?.error?.message || "Falha ao estender token" };
  }
  return { ok: true as const, access_token: rLong.json.access_token as string };
}

export async function listarPaginas(userAccessToken: string): Promise<Pagina[]> {
  const r = await jfetch(
    `${GRAPH_V25}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(userAccessToken)}`,
  );
  return (r.json?.data ?? []) as Pagina[];
}

// Salva ig_config e roda o webhook. Recebe já a página escolhida.
export async function finalizarConexaoMeta(
  userAccessToken: string,
  pagina: Pagina,
  redirect_uri: string,
): Promise<{ ok: true; username: string; webhook: { etapa1: any; etapa2: any } } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Buscar detalhes da página se ainda não temos IG account / token
  let pageAccessToken = pagina.access_token;
  let igAccountId = pagina.instagram_business_account?.id;

  if (!pageAccessToken || !igAccountId) {
    const r = await jfetch(
      `${GRAPH_V25}/${pagina.id}?fields=access_token,instagram_business_account&access_token=${encodeURIComponent(userAccessToken)}`,
    );
    if (!r.ok) return { ok: false, error: r.json?.error?.message || "Falha ao buscar página" };
    pageAccessToken = pageAccessToken || r.json.access_token;
    igAccountId = igAccountId || r.json.instagram_business_account?.id;
  }

  if (!igAccountId) return { ok: false, error: "Esta página não tem conta comercial do Instagram vinculada." };
  if (!pageAccessToken) return { ok: false, error: "Não foi possível obter o token da página." };

  const rUser = await jfetch(
    `${GRAPH_V25}/${igAccountId}?fields=username&access_token=${encodeURIComponent(userAccessToken)}`,
  );
  const username = rUser.json?.username ?? null;

  // Upsert em ig_config (linha única)
  await (supabaseAdmin as any).from("ig_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error: insErr } = await (supabaseAdmin as any).from("ig_config").insert({
    ig_user_id: igAccountId,
    access_token: userAccessToken,
    page_id: pagina.id,
    conta_username: username,
    token_gerado_em: new Date().toISOString(),
  });
  if (insErr) return { ok: false, error: insErr.message };

  // Configurar webhook automaticamente
  const origin = new URL(redirect_uri).origin;
  const callbackUrl = `${origin}/api/public/hooks/webhook-instagram`;
  const webhook = await configurarWebhookServerSide(pagina.id, pageAccessToken, callbackUrl);

  return { ok: true, username: username ?? pagina.name ?? "conta", webhook };
}

// Renova todos os tokens (para cron semanal)
export async function renovarTodosTokens() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { ok: false, error: "Credenciais Meta ausentes" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: configs } = await (supabaseAdmin as any).from("ig_config").select("id, access_token");
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const cfg of configs ?? []) {
    const url = new URL(`${GRAPH_V25}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("fb_exchange_token", cfg.access_token);
    const r = await jfetch(url.toString());
    if (r.ok && r.json?.access_token) {
      await (supabaseAdmin as any)
        .from("ig_config")
        .update({ access_token: r.json.access_token, token_gerado_em: new Date().toISOString() })
        .eq("id", cfg.id);
      results.push({ id: cfg.id, ok: true });
    } else {
      results.push({ id: cfg.id, ok: false, error: r.json?.error?.message || `HTTP ${r.status}` });
    }
  }
  return { ok: true, results };
}
