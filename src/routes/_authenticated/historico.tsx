import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RotateCcw, Clock, EyeOff, ScanSearch, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PostActions, StatusBadge } from "@/components/agenda/post-actions";
import { useRealtimePosts } from "@/hooks/use-realtime-posts";
import { BotaoAtualizar } from "@/components/agenda/botao-atualizar";
import { ErrosPublicacao } from "@/components/agenda/erros-publicacao";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verificarPublicacoes } from "@/lib/publicador.functions";
import { HistoricoTentativas } from "@/components/agenda/historico-tentativas";
import { registrarTentativaCliente } from "@/lib/tentativas";
import { MetricasPost } from "@/components/agenda/metricas-post";




export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico · QuitaMany" }] }),
  component: Historico,
});

function Historico() {
  const qc = useQueryClient();
  const { conectado } = useRealtimePosts();

  const { data: posts = [], isLoading, refetch } = useQuery({
    queryKey: ["historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts_agendados")
        .select("*")
        .in("status", ["publicado", "erro"])
        .order("publicado_em", { ascending: false, nullsFirst: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
    // Tempo real cuida da atualização; polling só como rede de segurança
    // enquanto o canal não estiver conectado.
    refetchInterval: conectado ? false : 20000,
    refetchOnWindowFocus: true,
  });



  const tentarNovamente = async (id: string) => {
    const { error } = await supabase
      .from("posts_agendados")
      .update({ status: "agendado", erro_msg: null, container_id: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await registrarTentativaCliente({
      postId: id,
      evento: "reenvio",
      etapa: "manual",
      mensagem: "Reenvio manual solicitado no Histórico",
    });
    toast.success("Post reagendado para nova tentativa");
    qc.invalidateQueries({ queryKey: ["historico"] });
  };

  const verificarFn = useServerFn(verificarPublicacoes);
  const [verificando, setVerificando] = useState(false);

  const verificar = async () => {
    setVerificando(true);
    try {
      const r = (await verificarFn({})) as {
        verificados: number;
        removidos: number;
        metricasAtualizadas: number;
        interrompidoPorToken: boolean;
        erros?: string[];
      };
      if (r.interrompidoPorToken) {
        toast.error("Token da Meta expirado. Reconecte a conta em Ajustes.");
      } else if (r.removidos > 0) {
        toast.warning(
          `${r.removidos} publicação(ões) removida(s) no Instagram · ${r.verificados} verificada(s)`,
        );
      } else {
        toast.success(
          `${r.verificados} publicação(ões) verificada(s)` +
            (r.metricasAtualizadas
              ? ` · ${r.metricasAtualizadas} com métricas atualizadas`
              : ". Nenhuma removida."),
        );
      }
      qc.invalidateQueries({ queryKey: ["historico"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao verificar publicações");
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Histórico</h1>
          <p className="text-sm text-muted-foreground">Publicados e falhas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={verificar} disabled={verificando}>
            {verificando ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <ScanSearch className="mr-2 h-3 w-3" />
            )}
            Verificar publicações
          </Button>
          <BotaoAtualizar onAtualizar={() => refetch()} />
        </div>
      </header>


      <ErrosPublicacao
        posts={posts.filter((p) => p.status === "erro") as any}
        onAtualizar={() => {
          qc.invalidateQueries({ queryKey: ["historico"] });
          qc.invalidateQueries({ queryKey: ["agenda"] });
        }}
      />



      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.titulo || p.legenda?.slice(0, 60) || "Sem título"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.publicado_em
                        ? format(new Date(p.publicado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : format(new Date(p.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={p.status} />
                    <TipoMidiaBadge tipo={(p as any).tipo_midia} />

                    {(p as any).removido_no_instagram && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <EyeOff className="h-3 w-3" />
                        Removido no Instagram
                      </span>
                    )}
                  </div>
                </div>
                {(p as any).removido_no_instagram && (p as any).verificado_em && (
                  <p className="text-[11px] text-muted-foreground">
                    Detectado em{" "}
                    {format(new Date((p as any).verificado_em), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                )}
                {p.status === "publicado" && (
                  <MetricasPost
                    curtidas={(p as any).curtidas}
                    comentarios={(p as any).comentarios}
                    compartilhamentos={(p as any).compartilhamentos}
                    reposts={(p as any).reposts}
                    metricasEm={(p as any).metricas_em}
                  />
                )}
                {p.status === "erro" && p.erro_msg && (
                  <p className="rounded-md bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
                    {p.erro_msg}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {p.permalink &&
                    ((p as any).removido_no_instagram ? (
                      // Post apagado no Instagram: o link levaria a uma página inexistente.
                      <span className="text-xs text-muted-foreground/70 line-through">
                        Publicação removida do Instagram
                      </span>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <a href={p.permalink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Ver no Instagram
                        </a>
                      </Button>
                    ))}

                  {p.status === "erro" && (
                    <Button size="sm" variant="outline" onClick={() => tentarNovamente(p.id)}>
                      <RotateCcw className="mr-2 h-3 w-3" />
                      Tentar de novo
                    </Button>
                  )}
                  <HistoricoTentativas postId={p.id} titulo={p.titulo} />
                  <div className="ml-auto">
                    <PostActions post={p as any} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
