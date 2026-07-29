import { supabase } from "@/integrations/supabase/client";

/** Tipos de evento registrados na linha do tempo de um post. */
export type TentativaEvento = "falha" | "reenvio" | "publicado" | "removido";

/** Uma entrada do histórico de tentativas de um post. */
export interface Tentativa {
  id: string;
  post_id: string;
  evento: TentativaEvento;
  etapa: string | null;
  mensagem: string;
  detalhe: unknown;
  criado_por: string | null;
  criado_em: string;
}

/**
 * Registra uma tentativa a partir do navegador (ex.: reenvio manual).
 * Nunca lança: o histórico é informativo e não pode derrubar a ação principal.
 */
export async function registrarTentativaCliente(input: {
  postId: string;
  evento: TentativaEvento;
  etapa?: string;
  mensagem: string;
  detalhe?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("post_tentativas").insert({
      post_id: input.postId,
      evento: input.evento,
      etapa: input.etapa ?? null,
      mensagem: input.mensagem,
      detalhe: (input.detalhe ?? null) as never,
      criado_por: userData.user?.id ?? null,
    });
  } catch (e) {
    console.error("[tentativas] falha ao registrar (ignorado):", e);
  }
}

/** Busca a linha do tempo completa de um post, mais recente primeiro. */
export async function listarTentativas(postId: string): Promise<Tentativa[]> {
  const { data, error } = await supabase
    .from("post_tentativas")
    .select("*")
    .eq("post_id", postId)
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Tentativa[];
}

/** Contagem de tentativas e data da última falha, por post. */
export interface ResumoTentativas {
  /** Quantas vezes o post foi efetivamente enviado/reenviado. */
  total: number;
  /** Data ISO da falha mais recente, se houver. */
  ultimaFalha: string | null;
}

/**
 * Resumo agregado de todos os posts em uma única consulta.
 *
 * Evita N requisições (uma por card). Consideramos como "tentativa" os eventos
 * de falha, reenvio e publicação — são os que representam um envio à Meta.
 */
export async function resumoTentativasPorPost(): Promise<Record<string, ResumoTentativas>> {
  const { data, error } = await supabase
    .from("post_tentativas")
    .select("post_id, evento, criado_em")
    .in("evento", ["falha", "reenvio", "publicado"])
    .order("criado_em", { ascending: false })
    .limit(3000);
  if (error) throw new Error(error.message);

  const mapa: Record<string, ResumoTentativas> = {};
  for (const linha of (data ?? []) as Array<{
    post_id: string;
    evento: TentativaEvento;
    criado_em: string;
  }>) {
    const atual = mapa[linha.post_id] ?? { total: 0, ultimaFalha: null };
    atual.total += 1;
    // Consulta vem ordenada do mais recente para o mais antigo:
    // a primeira falha encontrada já é a mais recente.
    if (linha.evento === "falha" && !atual.ultimaFalha) atual.ultimaFalha = linha.criado_em;
    mapa[linha.post_id] = atual;
  }
  return mapa;
}

