import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "pendente";

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async (): Promise<AppRole> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return "pendente";
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!data || data.length === 0) return "pendente";
      const roles = data.map((r) => r.role as AppRole);
      if (roles.includes("admin")) return "admin";
      if (roles.includes("editor")) return "editor";
      return "pendente";
    },
    staleTime: 30_000,
  });
}
