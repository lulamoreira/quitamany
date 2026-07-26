import { createFileRoute } from "@tanstack/react-router";

function redirectTo(origin: string, params: Record<string, string>) {
  const u = new URL(`${origin}/ajustes`);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

export const Route = createFileRoute("/api/public/meta-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (errorParam) return redirectTo(origin, { meta_erro: errorParam });
        if (!code || !state) return redirectTo(origin, { meta_erro: "Callback sem code/state" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await (supabaseAdmin as any)
          .from("meta_oauth_states")
          .select("*")
          .eq("state", state)
          .maybeSingle();

        if (!row) return redirectTo(origin, { meta_erro: "State inválido" });
        if (row.status === "conectado" || row.consumido_em) {
          return redirectTo(origin, { meta_state: state });
        }

        try {
          const { trocarCodePorTokenLongo, listarPaginas, finalizarConexaoMeta } = await import(
            "@/lib/meta-oauth.server"
          );

          const tok = await trocarCodePorTokenLongo(code, row.redirect_uri);
          if (!tok.ok) {
            await (supabaseAdmin as any)
              .from("meta_oauth_states")
              .update({ status: "erro", erro: tok.error })
              .eq("state", state);
            return redirectTo(origin, { meta_state: state });
          }

          let paginas = await listarPaginas(tok.access_token);
          // Fallback: se vazio e já existe page_id salvo, tentar com ele
          if (paginas.length === 0) {
            const { data: cfg } = await (supabaseAdmin as any)
              .from("ig_config")
              .select("page_id")
              .limit(1)
              .maybeSingle();
            if (cfg?.page_id) {
              paginas = [{ id: cfg.page_id } as any];
            }
          }

          if (paginas.length === 0) {
            await (supabaseAdmin as any)
              .from("meta_oauth_states")
              .update({
                status: "erro",
                erro: "Nenhuma página encontrada. Verifique se sua conta Instagram Business está vinculada a uma Página do Facebook.",
              })
              .eq("state", state);
            return redirectTo(origin, { meta_state: state });
          }

          if (paginas.length === 1) {
            const res = await finalizarConexaoMeta(tok.access_token, paginas[0], row.redirect_uri);
            await (supabaseAdmin as any)
              .from("meta_oauth_states")
              .update({
                status: res.ok ? "conectado" : "erro",
                erro: res.ok ? null : res.error,
                access_token: tok.access_token,
                paginas: paginas as any,
                consumido_em: new Date().toISOString(),
              })
              .eq("state", state);
            return redirectTo(origin, { meta_state: state });
          }

          // Múltiplas páginas → guardar e pedir escolha
          await (supabaseAdmin as any)
            .from("meta_oauth_states")
            .update({
              status: "escolher_pagina",
              access_token: tok.access_token,
              paginas: paginas as any,
            })
            .eq("state", state);
          return redirectTo(origin, { meta_state: state });
        } catch (e: any) {
          await (supabaseAdmin as any)
            .from("meta_oauth_states")
            .update({ status: "erro", erro: e?.message ?? "Erro inesperado" })
            .eq("state", state);
          return redirectTo(origin, { meta_state: state });
        }
      },
    },
  },
});
