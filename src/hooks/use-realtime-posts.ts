import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type LinhaPost = {
  id?: string;
  titulo?: string | null;
  status?: string | null;
  erro_msg?: string | null;
  instagram_permalink?: string | null;
  permalink?: string | null;
};

const PENDENTES = new Set(["rascunho", "agendado", "processando"]);

/** Horário local de São Paulo, formato HH:mm. */
function horaSaoPaulo(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function rotulo(post: LinhaPost): string {
  const titulo = (post.titulo ?? "").trim();
  return titulo.length > 0 ? titulo : "Post sem título";
}

/**
 * Assina em tempo real as mudanças da tabela de publicações agendadas.
 * Invalida as consultas de Agenda e Histórico e avisa por toast quando um
 * post pendente passa a publicado ou falha.
 *
 * Retorna `conectado`, para que as telas mantenham polling de segurança
 * apenas enquanto o canal em tempo real não estiver ativo.
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
        (payload) => {
          qc.invalidateQueries({ queryKey: ["posts-agendados"] });
          qc.invalidateQueries({ queryKey: ["historico"] });

          if (payload.eventType !== "UPDATE") return;

          const anterior = (payload.old ?? {}) as LinhaPost;
          const atual = (payload.new ?? {}) as LinhaPost;
          const antes = anterior.status ?? undefined;
          const depois = atual.status ?? undefined;
          if (!depois || antes === depois) return;
          // Só avisa na transição de "pendente" para desfecho final.
          if (antes && !PENDENTES.has(antes)) return;

          const hora = horaSaoPaulo();

          if (depois === "publicado") {
            const link = atual.instagram_permalink ?? atual.permalink ?? null;
            toast.success(`Publicado às ${hora}`, {
              description: rotulo(atual),
              action: link
                ? {
                    label: "Ver no Instagram",
                    onClick: () => window.open(link, "_blank", "noopener,noreferrer"),
                  }
                : undefined,
            });
            return;
          }

          if (depois === "erro") {
            toast.error(`Falha ao publicar às ${hora}`, {
              description: atual.erro_msg?.trim() || rotulo(atual),
            });
          }
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
