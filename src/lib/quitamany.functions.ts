import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH = "https://graph.facebook.com/v21.0";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores");
}

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
    return { ok: true as const, verify_token: token ?? "" };
  });
