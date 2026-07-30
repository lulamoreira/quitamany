import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Autorização: papel de admin verificado com o cliente do próprio usuário (RLS ativo).
    const { data: ehAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!ehAdmin) {
      return { ok: false as const, error: "Acesso restrito a administradores" };
    }

    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) return { ok: false as const, error: error.message };

    // Só depois de autorizar carregamos o cliente com chave de serviço.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const comEmail = await Promise.all(
      (roles ?? []).map(async (r) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
        return { ...r, email: data?.user?.email ?? null };
      }),
    );

    return { ok: true as const, roles: comEmail };
  });
