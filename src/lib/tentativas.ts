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
