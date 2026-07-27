// Server-only: processa eventos do webhook do Instagram
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ehParada, ehRetorno } from "@/lib/opt-out";

const GRAPH = "https://graph.facebook.com/v21.0";

type Automacao = {
  id: string;
  nome: string;
  tipo: "gatilho_comentario" | "palavra_chave_dm" | "boas_vindas";
  ativa: boolean;
  palavras: string[];
  post_ig_id: string | null;
  resposta_comentario: string | null;
  resposta_dm: string;
  botoes: Array<{ titulo: string }>;
  etiqueta_aplicar: string | null;
  execucoes: number;
};

async function getIgConfig() {
  const { data } = await supabaseAdmin.from("ig_config").select("*").limit(1).maybeSingle();
  return data as { ig_user_id: string; access_token: string } | null;
}

async function logEvento(tipo: string, payload: unknown, erro?: string) {
  await (supabaseAdmin as any).from("eventos_webhook").insert({
    tipo,
    payload: payload as any,
    processado: !erro,
    erro: erro ?? null,
  });
}

async function fetchUserInfo(igUserId: string, token: string, userId: string) {
  try {
    const url = `${GRAPH}/${userId}?fields=username,name,profile_pic&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j.error) return null;
    return { username: j.username as string | undefined, nome: j.name as string | undefined, foto_url: j.profile_pic as string | undefined };
  } catch {
    return null;
  }
}

async function upsertContato(igId: string, extra: { username?: string; nome?: string; foto_url?: string }) {
  const { data: existing } = await (supabaseAdmin as any)
    .from("contatos")
    .select("*")
    .eq("ig_id", igId)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    await (supabaseAdmin as any)
      .from("contatos")
      .update({
        username: extra.username ?? existing.username,
        nome: extra.nome ?? existing.nome,
        foto_url: extra.foto_url ?? existing.foto_url,
        ultima_interacao: now,
      })
      .eq("id", existing.id);
    return existing;
  }
  const { data: created } = await (supabaseAdmin as any)
    .from("contatos")
    .insert({
      ig_id: igId,
      username: extra.username ?? null,
      nome: extra.nome ?? null,
      foto_url: extra.foto_url ?? null,
      primeira_interacao: now,
      ultima_interacao: now,
    })
    .select("*")
    .single();
  return created;
}

async function upsertConversa(contatoId: string) {
  const { data: existing } = await (supabaseAdmin as any)
    .from("conversas")
    .select("*")
    .eq("contato_id", contatoId)
    .maybeSingle();
  if (existing) return existing;
  const { data: created } = await (supabaseAdmin as any)
    .from("conversas")
    .insert({ contato_id: contatoId, modo: "automatico", nao_lidas: 0 })
    .select("*")
    .single();
  return created;
}

async function sendDM(igUserId: string, token: string, recipient: { id?: string; comment_id?: string }, text: string, botoes?: Array<{ titulo: string }>) {
  const message: any = { text };
  if (botoes && botoes.length > 0) {
    message.quick_replies = botoes.slice(0, 3).map((b) => ({
      content_type: "text",
      title: b.titulo,
      payload: b.titulo.toUpperCase().replace(/\s+/g, "_"),
    }));
  }
  const body = { recipient, message };
  const r = await fetch(`${GRAPH}/${igUserId}/messages?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, body: j };
}

async function replyToComment(commentId: string, token: string, text: string) {
  const url = `${GRAPH}/${commentId}/replies`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message: text, access_token: token }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, body: j };
}

async function saveMensagem(
  conversaId: string,
  direcao: "recebida" | "enviada",
  texto: string,
  enviadaPor: "robo" | "humano" | null,
  payload?: any,
  mid?: string | null,
) {
  await (supabaseAdmin as any).from("mensagens").insert({
    conversa_id: conversaId,
    direcao,
    texto,
    enviada_por: enviadaPor,
    payload_bruto: payload ?? null,
    mid: mid ?? null,
  });
}

async function dentroDaJanela(conversaId: string): Promise<boolean> {
  const { data } = await (supabaseAdmin as any)
    .from("conversas")
    .select("janela_expira_em")
    .eq("id", conversaId)
    .maybeSingle();
  const j = data?.janela_expira_em;
  if (!j) return true;
  return new Date(j).getTime() > Date.now();
}

async function updateConversaAfterReceive(conversaId: string, texto: string) {
  const now = new Date();
  const janela = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: c } = await (supabaseAdmin as any)
    .from("conversas")
    .select("nao_lidas")
    .eq("id", conversaId)
    .single();
  await (supabaseAdmin as any)
    .from("conversas")
    .update({
      ultima_mensagem: texto,
      ultima_msg_em: now.toISOString(),
      janela_expira_em: janela,
      nao_lidas: (c?.nao_lidas ?? 0) + 1,
    })
    .eq("id", conversaId);
}

async function updateConversaAfterSend(conversaId: string, texto: string) {
  await (supabaseAdmin as any)
    .from("conversas")
    .update({ ultima_mensagem: texto, ultima_msg_em: new Date().toISOString() })
    .eq("id", conversaId);
}

async function aplicarEtiqueta(contatoId: string, etiqueta: string) {
  const { data } = await (supabaseAdmin as any).from("contatos").select("etiquetas").eq("id", contatoId).single();
  const atuais: string[] = data?.etiquetas ?? [];
  if (atuais.includes(etiqueta)) return;
  await (supabaseAdmin as any).from("contatos").update({ etiquetas: [...atuais, etiqueta] }).eq("id", contatoId);
}

async function incAutomacao(id: string) {
  const { data } = await (supabaseAdmin as any).from("automacoes").select("execucoes").eq("id", id).single();
  await (supabaseAdmin as any).from("automacoes").update({ execucoes: (data?.execucoes ?? 0) + 1 }).eq("id", id);
}

function matchPalavra(texto: string, palavras: string[]) {
  const t = texto.toLowerCase();
  return palavras.some((p) => p && t.includes(p.toLowerCase()));
}

async function getAutomacoes(tipo: Automacao["tipo"]): Promise<Automacao[]> {
  const { data } = await (supabaseAdmin as any)
    .from("automacoes")
    .select("*")
    .eq("tipo", tipo)
    .eq("ativa", true);
  return (data as Automacao[]) ?? [];
}

async function handleComentario(value: any) {
  const cfg = await getIgConfig();
  if (!cfg) return;
  const commentId: string = value.id;
  const texto: string = value.text ?? "";
  const mediaId: string | undefined = value.media?.id;
  const from = value.from ?? {};

  // Ignora comentários da própria conta
  if (from?.id && from.id === cfg.ig_user_id) return;

  const autos = await getAutomacoes("gatilho_comentario");
  for (const a of autos) {
    if (a.post_ig_id && mediaId && a.post_ig_id !== mediaId) continue;
    if (!matchPalavra(texto, a.palavras)) continue;

    if (a.resposta_comentario) {
      const r = await replyToComment(commentId, cfg.access_token, a.resposta_comentario);
      if (!r.ok && r.body?.error?.code === 190) {
        await logEvento("token_expirado", r.body, "Token expirado");
        return;
      }
    }

    // Private reply via DM (não aplica checagem de janela de 24h; regra própria da Meta para comentários)
    const info = from?.id ? await fetchUserInfo(cfg.ig_user_id, cfg.access_token, from.id) : null;
    let contato: any = null;
    if (from?.id) {
      contato = await upsertContato(from.id, { username: info?.username ?? from.username, nome: info?.nome, foto_url: info?.foto_url });
    }

    // Se o contato optou por sair, não envia a DM privada — mas o comentário público já foi respondido acima.
    if (contato?.opt_out === true) {
      await logEvento("opt_out_bloqueou_dm_comentario", { contato_id: contato.id, comment_id: commentId });
      await incAutomacao(a.id);
      break;
    }

    const send = await sendDM(cfg.ig_user_id, cfg.access_token, { comment_id: commentId }, a.resposta_dm, a.botoes);
    if (!send.ok) {
      const errMsg = send.body?.error?.message ?? "Falha ao enviar DM";
      await logEvento("erro_envio_dm", send.body, errMsg);
      if (send.body?.error?.code === 190) return;
      break;
    }
    if (contato) {
      const conv = await upsertConversa(contato.id);
      await saveMensagem(conv.id, "enviada", a.resposta_dm, "robo", send.body);
      await updateConversaAfterSend(conv.id, a.resposta_dm);
      if (a.etiqueta_aplicar) await aplicarEtiqueta(contato.id, a.etiqueta_aplicar);
    }
    await incAutomacao(a.id);
    break;
  }
}

async function handleMensagem(igUserId: string, token: string, sender: string, texto: string, payload: any) {
  const info = await fetchUserInfo(igUserId, token, sender);
  const contato = await upsertContato(sender, { username: info?.username, nome: info?.nome, foto_url: info?.foto_url });
  const conv = await upsertConversa(contato.id);
  const mid = payload?.message?.mid ?? null;
  await saveMensagem(conv.id, "recebida", texto, null, payload, mid);
  await updateConversaAfterReceive(conv.id, texto);

  // ---- Opt-out / retorno (antes de qualquer automação) ----
  if (ehRetorno(texto)) {
    await (supabaseAdmin as any)
      .from("contatos")
      .update({ opt_out: false, opt_out_em: null })
      .eq("id", contato.id);
    const send = await sendDM(igUserId, token, { id: sender }, "Pronto! Você voltou a receber nossas mensagens.");
    if (send.ok) {
      await saveMensagem(conv.id, "enviada", "Pronto! Você voltou a receber nossas mensagens.", "robo", send.body);
      await updateConversaAfterSend(conv.id, "Pronto! Você voltou a receber nossas mensagens.");
    } else {
      await logEvento("erro_envio_dm", send.body, send.body?.error?.message ?? "Falha ao enviar DM (retorno)");
    }
    return;
  }

  if (ehParada(texto)) {
    await (supabaseAdmin as any)
      .from("contatos")
      .update({ opt_out: true, opt_out_em: new Date().toISOString() })
      .eq("id", contato.id);
    const msg = "Você não receberá mais mensagens automáticas. Envie VOLTAR quando quiser retomar.";
    const send = await sendDM(igUserId, token, { id: sender }, msg);
    if (send.ok) {
      await saveMensagem(conv.id, "enviada", msg, "robo", send.body);
      await updateConversaAfterSend(conv.id, msg);
    } else {
      await logEvento("erro_envio_dm", send.body, send.body?.error?.message ?? "Falha ao enviar DM (parada)");
    }
    return;
  }

  // Se contato já estava em opt-out, robô não responde. Mensagem já foi gravada para atendimento humano.
  const { data: contatoAtual } = await (supabaseAdmin as any)
    .from("contatos")
    .select("opt_out")
    .eq("id", contato.id)
    .maybeSingle();
  if (contatoAtual?.opt_out === true) return;

  // Não responder se modo humano
  const { data: convAtual } = await (supabaseAdmin as any)
    .from("conversas")
    .select("modo")
    .eq("id", conv.id)
    .single();
  if (convAtual?.modo === "humano") return;

  // Primeira mensagem? conta mensagens recebidas
  const { count } = await (supabaseAdmin as any)
    .from("mensagens")
    .select("id", { count: "exact", head: true })
    .eq("conversa_id", conv.id)
    .eq("direcao", "recebida");

  if (count === 1) {
    const bv = await getAutomacoes("boas_vindas");
    if (bv.length > 0) {
      const a = bv[0];
      if (!(await dentroDaJanela(conv.id))) {
        await logEvento("fora_da_janela", { conversa_id: conv.id, automacao_id: a.id, tipo: "boas_vindas" });
        return;
      }
      const send = await sendDM(igUserId, token, { id: sender }, a.resposta_dm, a.botoes);
      if (send.ok) {
        await saveMensagem(conv.id, "enviada", a.resposta_dm, "robo", send.body);
        await updateConversaAfterSend(conv.id, a.resposta_dm);
        if (a.etiqueta_aplicar) await aplicarEtiqueta(contato.id, a.etiqueta_aplicar);
        await incAutomacao(a.id);
        return;
      }
      const errMsg = send.body?.error?.message ?? "Falha ao enviar DM";
      await logEvento("erro_envio_dm", send.body, errMsg);
      if (send.body?.error?.code === 190) return;
    }
  }

  const kws = await getAutomacoes("palavra_chave_dm");
  for (const a of kws) {
    if (!matchPalavra(texto, a.palavras)) continue;
    if (!(await dentroDaJanela(conv.id))) {
      await logEvento("fora_da_janela", { conversa_id: conv.id, automacao_id: a.id, tipo: "palavra_chave_dm" });
      break;
    }
    const send = await sendDM(igUserId, token, { id: sender }, a.resposta_dm, a.botoes);
    if (send.ok) {
      await saveMensagem(conv.id, "enviada", a.resposta_dm, "robo", send.body);
      await updateConversaAfterSend(conv.id, a.resposta_dm);
      if (a.etiqueta_aplicar) await aplicarEtiqueta(contato.id, a.etiqueta_aplicar);
      await incAutomacao(a.id);
    } else {
      const errMsg = send.body?.error?.message ?? "Falha ao enviar DM";
      await logEvento("erro_envio_dm", send.body, errMsg);
    }
    break;
  }
}

async function handleUnsend(mid: string) {
  const { data: msg } = await (supabaseAdmin as any)
    .from("mensagens")
    .select("id, conversa_id")
    .eq("mid", mid)
    .maybeSingle();
  if (!msg) return;
  await (supabaseAdmin as any).from("mensagens").update({ apagada: true }).eq("id", msg.id);

  // Se era a última mensagem da conversa, ajusta ultima_mensagem
  const { data: ultima } = await (supabaseAdmin as any)
    .from("mensagens")
    .select("id")
    .eq("conversa_id", msg.conversa_id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima?.id === msg.id) {
    await (supabaseAdmin as any)
      .from("conversas")
      .update({ ultima_mensagem: "Mensagem apagada" })
      .eq("id", msg.conversa_id);
  }
}

export async function processarWebhook(body: any): Promise<{ ok: true }> {
  const cfg = await getIgConfig();
  await logEvento("webhook_recebido", body);

  const entries = body?.entry ?? [];
  for (const entry of entries) {
    // DMs
    const messaging = entry.messaging ?? [];
    for (const m of messaging) {
      const senderId = m.sender?.id;
      const recipientId = m.recipient?.id;
      const isEcho = m.message?.is_echo === true;
      // Ignora ecos da própria conta
      if (isEcho) continue;
      if (!cfg) continue;
      if (senderId && senderId === cfg.ig_user_id) continue;
      const texto = m.message?.text ?? "";
      if (!texto || !senderId) continue;
      try {
        await handleMensagem(cfg.ig_user_id, cfg.access_token, senderId, texto, m);
      } catch (e: any) {
        await logEvento("erro_mensagem", m, e?.message ?? String(e));
      }
    }
    // Comentários
    const changes = entry.changes ?? [];
    for (const ch of changes) {
      if (ch.field !== "comments") continue;
      try {
        await handleComentario(ch.value);
      } catch (e: any) {
        await logEvento("erro_comentario", ch, e?.message ?? String(e));
      }
    }
  }
  return { ok: true };
}
