import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH = "https://graph.facebook.com/v21.0";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito a administradores");
}

// Testa conexão com a API do Instagram e salva credenciais
export const testarConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ig_user_id: string; access_token: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const url = `${GRAPH}/${data.ig_user_id}?fields=username&access_token=${encodeURIComponent(data.access_token)}`;
    const resp = await fetch(url);
    const body = await resp.json();
    if (!resp.ok || body.error) {
      return { ok: false as const, error: body.error?.message || "Falha ao conectar" };
    }
    const conta_username = body.username as string;
    // Upsert single-row config: delete existing then insert
    await context.supabase.from("ig_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await context.supabase.from("ig_config").insert({
      ig_user_id: data.ig_user_id,
      access_token: data.access_token,
      conta_username,
      token_gerado_em: new Date().toISOString(),
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, username: conta_username };
  });

// Renova o token de longa duração
export const renovarToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: cfg } = await context.supabase.from("ig_config").select("*").limit(1).single();
    if (!cfg) return { ok: false as const, error: "Sem configuração salva" };
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      return { ok: false as const, error: "Credenciais do app Meta não configuradas" };
    }
    const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(cfg.access_token)}`;
    const resp = await fetch(url);
    const body = await resp.json();
    if (!resp.ok || body.error) return { ok: false as const, error: body.error?.message || "Falha na renovação" };
    await context.supabase
      .from("ig_config")
      .update({ access_token: body.access_token, token_gerado_em: new Date().toISOString() })
      .eq("id", cfg.id);
    return { ok: true as const };
  });

// Publica um post agora (marca como agendado imediatamente)
export const publicarAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("posts_agendados")
      .update({ status: "agendado", agendado_para: new Date().toISOString() })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
