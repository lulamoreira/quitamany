// Registro server-side de tentativas de publicação. Não importar do cliente.

export type TentativaEvento = "falha" | "reenvio" | "publicado" | "removido";

/**
 * Grava uma entrada na linha do tempo do post.
 *
 * Deliberadamente tolerante a falhas: o histórico é observabilidade, e um erro
 * ao registrá-lo jamais pode interromper o motor de publicação.
 */
export async function registrarTentativa(
  supabaseAdmin: { from: (t: string) => any },
  input: {
    postId: string;
    evento: TentativaEvento;
    etapa?: string;
    mensagem: string;
    detalhe?: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    await supabaseAdmin.from("post_tentativas").insert({
      post_id: input.postId,
      evento: input.evento,
      etapa: input.etapa ?? null,
      mensagem: (input.mensagem || "").slice(0, 2000),
      detalhe: input.detalhe ?? null,
    });
  } catch (e) {
    console.error("[tentativas] falha ao registrar (ignorado):", e);
  }
}
