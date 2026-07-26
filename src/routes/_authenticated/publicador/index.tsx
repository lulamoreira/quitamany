import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, PlusCircle, FileDown } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { calendarioEditorial } from "@/lib/calendario-editorial";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/publicador/")({
  head: () => ({
    meta: [{ title: "Agenda · Publicador" }],
  }),
  component: AgendaPage,
});

const statusColor: Record<string, string> = {
  agendado: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  processando: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  publicado: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  erro: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  rascunho: "bg-muted text-muted-foreground border-border",
};

function AgendaPage() {
  const navigate = useNavigate();
  const [month] = useState(new Date());
  const [importando, setImportando] = useState(false);
  const queryClient = useQueryClient();

  async function importarCalendario() {
    setImportando(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw userErr ?? new Error("Sem usuário");
      const userId = userData.user.id;

      const titulos = calendarioEditorial.map((c) => c.titulo);
      const { data: existentes, error: exErr } = await supabase
        .from("posts_agendados")
        .select("titulo")
        .eq("status", "rascunho")
        .in("titulo", titulos);
      if (exErr) throw exErr;
      const jaExistem = new Set((existentes ?? []).map((r) => r.titulo));

      const novos = calendarioEditorial
        .filter((c) => !jaExistem.has(c.titulo))
        .map((c) => ({
          titulo: c.titulo,
          legenda: c.legenda,
          hashtags: c.hashtags,
          status: "rascunho" as const,
          criado_por: userId,
        }));

      if (novos.length === 0) {
        toast.info("Todos os posts do calendário já estão como rascunho.");
        return;
      }

      const { error: insErr } = await supabase.from("posts_agendados").insert(novos);
      if (insErr) throw insErr;

      toast.success(`${novos.length} rascunho(s) importado(s) do calendário editorial.`);
      queryClient.invalidateQueries({ queryKey: ["posts-agendados"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar calendário");
    } finally {
      setImportando(false);
    }
  }


  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts-agendados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts_agendados")
        .select("*")
        .in("status", ["agendado", "processando", "rascunho"])
        .order("agendado_para", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const daysWithPosts = useMemo(() => {
    return new Set(
      posts
        .filter((p) => p.agendado_para)
        .map((p) => format(new Date(p.agendado_para as string), "yyyy-MM-dd")),
    );
  }, [posts]);

  // build calendar
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startPad = first.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(month.getFullYear(), month.getMonth(), d));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Seus próximos posts no Instagram</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={importarCalendario}
          disabled={importando}
        >
          <FileDown className="mr-2 h-4 w-4" />
          {importando ? "Importando…" : "Importar calendário editorial"}
        </Button>
      </header>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4" />
            {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} className="py-1">{d}</div>
            ))}
            {days.map((d, i) => {
              if (!d) return <div key={i} />;
              const has = daysWithPosts.has(format(d, "yyyy-MM-dd"));
              const today = isSameDay(d, new Date());
              return (
                <div
                  key={i}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-md text-sm",
                    today ? "bg-primary text-primary-foreground font-semibold" : "text-foreground",
                  )}
                >
                  {d.getDate()}
                  {has && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Próximos posts</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhum post agendado ainda — que tal criar o primeiro?
              </p>
              <Button onClick={() => navigate({ to: "/publicador/novo" })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar post
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer transition-colors hover:bg-accent/40"
                onClick={() => navigate({ to: "/publicador/novo", search: { id: p.id } as any })}
              >
                <CardContent className="flex gap-3 p-3">
                  {p.video_url ? (
                    <video
                      src={p.video_url}
                      className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                      muted
                    />
                  ) : (
                    <div className="h-16 w-16 flex-shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.titulo || p.legenda?.slice(0, 40) || "Sem título"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.agendado_para
                        ? format(new Date(p.agendado_para), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })
                        : "Rascunho"}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn("mt-1 text-xs", statusColor[p.status] || "")}
                    >
                      {p.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
