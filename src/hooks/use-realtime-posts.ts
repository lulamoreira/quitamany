import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina em tempo real as mudanças da tabela de publicações agendadas.
 * Sempre que uma linha for criada, alterada ou removida, as consultas
 * de Agenda e Histórico são invalidadas — sem polling e sem recarregar.
 *
 * Retorna `conectado`, que permite às telas manterem um polling de
 * segurança apenas quando o canal em tempo real não estiver ativo.
 */
export function useRealtimePosts(): { conectado: boolean } {
  const qc = useQueryClient();
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const canal = supabase
      .channel(`posts-agendados-rt-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts_agendados" },
        () => {
          qc.invalidateQueries({ queryKey: ["posts-agendados"] });
          qc.invalidateQueries({ queryKey: ["historico"] });
        },
      )
      .subscribe((status) => {
        setConectado(status === "SUBSCRIBED");
      });

    return () => {
      setConectado(false);
      supabase.removeChannel(canal);
    };
  }, [qc]);

  return { conectado };
}
