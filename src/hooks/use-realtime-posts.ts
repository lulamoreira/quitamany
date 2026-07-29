import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina as mudanças em tempo real da tabela de publicações agendadas.
 * Sempre que uma linha for criada, alterada ou removida, as consultas
 * relacionadas são invalidadas — sem precisar recarregar a página.
 */
export function useRealtimePosts(extraKeys: string[] = []) {
  const qc = useQueryClient();

  useEffect(() => {
    const canal = supabase
      .channel(`posts-agendados-rt-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts_agendados" },
        () => {
          qc.invalidateQueries({ queryKey: ["posts-agendados"] });
          qc.invalidateQueries({ queryKey: ["historico"] });
          for (const k of extraKeys) qc.invalidateQueries({ queryKey: [k] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, extraKeys.join("|")]);
}
