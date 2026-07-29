import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Conversa com mensagens não lidas, usada no sino de notificações. */
export type NotificacaoConversa = {
  id: string;
  nao_lidas: number;
  ultima_mensagem: string | null;
  ultima_msg_em: string | null;
  contatos: { id: string; username: string | null; nome: string | null; foto_url: string | null } | null;
};

export const NOTIFICACOES_QUERY_KEY = ["qm-notificacoes"] as const;

/**
 * Lista as conversas com mensagens não lidas e mantém o resultado atualizado
 * em tempo real (novas mensagens ou alterações em conversas).
 *
 * A leitura respeita as políticas de RLS: apenas admin/editor recebem dados.
 */
export function useNotificacoes(): {
  conversas: NotificacaoConversa[];
  total: number;
  isLoading: boolean;
} {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: NOTIFICACOES_QUERY_KEY,
    queryFn: async (): Promise<NotificacaoConversa[]> => {
      const { data, error } = await supabase
        .from("conversas")
        .select("id, nao_lidas, ultima_mensagem, ultima_msg_em, contatos(id, username, nome, foto_url)")
        .gt("nao_lidas", 0)
        .order("ultima_msg_em", { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) return [];
      return (data as unknown as NotificacaoConversa[]) ?? [];
    },
    // Rede de segurança caso o canal em tempo real caia.
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const canal = supabase
      .channel(`qm-notificacoes-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas" }, () => {
        qc.invalidateQueries({ queryKey: NOTIFICACOES_QUERY_KEY });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, () => {
        qc.invalidateQueries({ queryKey: NOTIFICACOES_QUERY_KEY });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [qc]);

  const conversas = data ?? [];
  const total = conversas.reduce((acc, c) => acc + (c.nao_lidas || 0), 0);

  return { conversas, total, isLoading };
}
