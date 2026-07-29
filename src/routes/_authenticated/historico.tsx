import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RotateCcw, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PostActions, StatusBadge } from "@/components/agenda/post-actions";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico · QuitaMany" }] }),
  component: Historico,
});

function Historico() {
  const qc = useQueryClient();
  const { data: posts = [], isLoading } = useQuery({
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
    // Novos publicados aparecem sem recarregar a página.
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });


  const tentarNovamente = async (id: string) => {
    const { error } = await supabase
      .from("posts_agendados")
      .update({ status: "agendado", erro_msg: null, container_id: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Post reagendado para nova tentativa");
    qc.invalidateQueries({ queryKey: ["historico"] });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-muted-foreground">Publicados e falhas</p>
      </header>

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
                  <StatusBadge status={p.status} />
                </div>
                {p.status === "erro" && p.erro_msg && (
                  <p className="rounded-md bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
                    {p.erro_msg}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {p.permalink && (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.permalink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Ver no Instagram
                      </a>
                    </Button>
                  )}
                  {p.status === "erro" && (
                    <Button size="sm" variant="outline" onClick={() => tentarNovamente(p.id)}>
                      <RotateCcw className="mr-2 h-3 w-3" />
                      Tentar de novo
                    </Button>
                  )}
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
