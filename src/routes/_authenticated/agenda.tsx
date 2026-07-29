import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, PlusCircle, FileDown, LayoutGrid, LayoutList } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { calendarioEditorial } from "@/lib/calendario-editorial";
import { toast } from "sonner";
import { useIsDesktop, useSavedView } from "@/hooks/use-desktop";
import { DesktopPageHeader } from "@/components/desktop-shell";
import { AgendaKanban } from "@/components/agenda/agenda-kanban";
import { AgendaCalendarDesktop } from "@/components/agenda/agenda-calendar";
import { PostActions, StatusBadge } from "@/components/agenda/post-actions";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [{ title: "Agenda · QuitaMany" }],
  }),
  component: AgendaPage,
});


function AgendaPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [view, setView] = useSavedView<"kanban" | "calendario">("agenda-view", "kanban");
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

  // Desktop precisa de TODOS (inclui publicado e erro para o kanban).
  // Mobile mantém filtro original.
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts-agendados", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts_agendados")
        .select("*")
        .order("agendado_para", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  // ---- Desktop ----
  if (isDesktop) {
    return (
      <>
        <DesktopPageHeader
          breadcrumb="Publicações"
          title="Agenda"
          subtitle="Arraste os posts entre colunas para agendar, desagendar ou reprogramar."
          actions={
            <>
              <div className="flex overflow-hidden rounded-lg border">
                <button
                  onClick={() => setView("kanban")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    view === "kanban" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                </button>
                <button
                  onClick={() => setView("calendario")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    view === "calendario" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent",
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Calendário
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={importarCalendario} disabled={importando}>
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                {importando ? "Importando…" : "Importar calendário"}
              </Button>
              <Button size="sm" onClick={() => navigate({ to: "/novo" })}>
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Novo post
              </Button>
            </>
          }
        />
        <div className="w-full">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : view === "kanban" ? (
            <AgendaKanban posts={posts as any} />
          ) : (
            <AgendaCalendarDesktop posts={posts as any} />
          )}
        </div>
      </>
    );
  }

  // ---- Mobile (inalterado) ----
  const daysWithPosts = new Set(
    posts.filter((p) => p.agendado_para).map((p) => format(new Date(p.agendado_para as string), "yyyy-MM-dd")),
  );
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
                  {has && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />}
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
              <Button onClick={() => navigate({ to: "/novo" })}>
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
                onClick={() => navigate({ to: "/novo", search: { id: p.id } as any })}
              >
                <CardContent className="flex gap-3 p-3">
                  {p.video_url ? (
                    <video src={p.video_url} className="h-16 w-16 flex-shrink-0 rounded-md object-cover" muted />
                  ) : (
                    <div className="h-16 w-16 flex-shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">
                      {p.titulo || p.legenda?.slice(0, 40) || "Sem título"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.agendado_para
                        ? format(new Date(p.agendado_para), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })
                        : p.publicado_em
                          ? `Publicado em ${format(new Date(p.publicado_em), "dd 'de' MMM", { locale: ptBR })}`
                          : "Rascunho"}
                    </p>
                    {p.status === "erro" && p.erro_msg && (
                      <p className="mt-1 line-clamp-1 text-xs text-destructive">{p.erro_msg}</p>
                    )}
                    <div className="mt-2">
                      <PostActions post={p as any} />
                    </div>
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
