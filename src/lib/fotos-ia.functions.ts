import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cria um rascunho de post a partir de imagens geradas na tela "Fotos com IA".
 * O upload para o Storage acontece no cliente; aqui só gravamos as URLs na
 * ordem escolhida pelo usuário (a primeira é a capa do carrossel).
 */
export const criarRascunhoDeImagens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { urls: string[] }) => {
    const urls = Array.isArray(d?.urls)
      ? d.urls.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
    if (urls.length === 0) throw new Error("Nenhuma imagem informada.");
    if (urls.length > 10) throw new Error("Máximo de 10 imagens por carrossel.");
    return { urls };
  })
  .handler(async ({ data, context }) => {
    const tipo_midia = data.urls.length === 1 ? "imagem" : "carrossel";
    const { data: row, error } = await context.supabase
      .from("posts_agendados")
      .insert({
        status: "rascunho",
        tipo_midia,
        midia_itens: data.urls.map((url) => ({ url })),
        titulo: null,
        legenda: "",
        hashtags: "",
        criado_por: context.userId,
      })
      .select("id")
      .single();

    if (error || !row) {
      return { ok: false as const, error: error?.message ?? "Falha ao criar o rascunho." };
    }
    return { ok: true as const, id: row.id as string };
  });
