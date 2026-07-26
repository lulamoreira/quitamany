import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Bot, UserCheck, Clock, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-desktop";
import { DesktopPageHeader } from "@/components/desktop-shell";

export const Route = createFileRoute("/_authenticated/quitamany/")({
  head: () => ({ meta: [{ title: "Conversas · QuitaMany" }] }),
  component: InboxPage,
});

type ConversaComContato = {
  id: string;
  modo: "automatico" | "humano";
  janela_expira_em: string | null;
  ultima_mensagem: string | null;
  ultima_msg_em: string | null;
  nao_lidas: number;
  contatos: { id: string; username: string | null; nome: string | null; foto_url: string | null } | null;
};

function InboxPage() {
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();
  const [filtro, setFiltro] = useState<"todas" | "auto" | "humano" | "nao-lidas">("todas");
  const [busca, setBusca] = useState("");

  const { data: conversas, isLoading } = useQuery({
    queryKey: ["quitamany-conversas"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conversas")
        .select("id, modo, janela_expira_em, ultima_mensagem, ultima_msg_em, nao_lidas, contatos(id, username, nome, foto_url)")
        .order("ultima_msg_em", { ascending: false, nullsFirst: false });
      return (data as ConversaComContato[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("qm-conversas")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas" }, () => {
        qc.invalidateQueries({ queryKey: ["quitamany-conversas"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, () => {
        qc.invalidateQueries({ queryKey: ["quitamany-conversas"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtradas = (conversas ?? []).filter((c) => {
    if (filtro === "auto" && c.modo !== "automatico") return false;
    if (filtro === "humano" && c.modo !== "humano") return false;
    if (filtro === "nao-lidas" && (c.nao_lidas ?? 0) === 0) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return (c.contatos?.username ?? "").toLowerCase().includes(q) || (c.contatos?.nome ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  // ---- Desktop: 3 colunas (lista à esquerda + placeholder no meio/direita) ----
  if (isDesktop) {
    return (
      <>
        <DesktopPageHeader
          breadcrumb="QuitaMany"
          title="Conversas"
          subtitle="Inbox ao vivo do Instagram Direct."
        />
        <div className="grid h-[calc(100vh-6rem)] grid-cols-[320px_1fr] overflow-hidden">
          {/* Lista */}
          <aside className="flex flex-col border-r bg-card">
            <div className="border-b p-3">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar conversa…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex gap-1 text-[11px] font-medium">
                {(["todas", "auto", "humano", "nao-lidas"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={cn(
                      "flex-1 rounded-md px-1.5 py-1 transition-colors",
                      filtro === f ? "bg-primary text-primary-foreground" : "bg-accent/50 text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {f === "todas" ? "Todas" : f === "auto" ? "Auto" : f === "humano" ? "Humano" : "Não lidas"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-1 p-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}
                </div>
              ) : filtradas.length === 0 ? (
                <EmptyState />
              ) : (
                filtradas.map((c) => <ConversaRow key={c.id} c={c} />)
              )}
            </div>
          </aside>

          {/* Placeholder direita */}
          <div className="flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <MessageCircle className="mx-auto h-14 w-14 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">Selecione uma conversa</p>
              <p className="mt-1 text-xs text-muted-foreground">Escolha um contato da lista para começar a responder.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ---- Mobile (inalterado) ----
  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Conversas</h1>
        <p className="text-sm text-muted-foreground">Inbox ao vivo do Instagram Direct.</p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : !conversas || conversas.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {conversas.map((c) => <ConversaCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

/** Compact list row usado no painel esquerdo do desktop. */
function ConversaRow({ c }: { c: ConversaComContato }) {
  const nome = c.contatos?.nome || c.contatos?.username || "Sem nome";
  const inicial = (nome[0] ?? "?").toUpperCase();
  return (
    <Link to="/quitamany/conversa/$id" params={{ id: c.id }}>
      {({ isActive }: any) => (
        <div
          className={cn(
            "flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 transition-colors",
            isActive ? "bg-primary/10" : "hover:bg-accent/50",
          )}
        >
          <Avatar className="h-10 w-10 shrink-0">
            {c.contatos?.foto_url ? <AvatarImage src={c.contatos.foto_url} alt={nome} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{inicial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <p className="truncate text-sm font-semibold">
                {c.contatos?.username ? `@${c.contatos.username}` : nome}
              </p>
              {c.ultima_msg_em && (
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.ultima_msg_em), { locale: ptBR, addSuffix: false })}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{c.ultima_mensagem || "Sem mensagens"}</p>
          </div>
          {c.nao_lidas > 0 && (
            <span className="ml-1 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {c.nao_lidas}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

function ConversaCard({ c }: { c: ConversaComContato }) {
  const nome = c.contatos?.nome || c.contatos?.username || "Sem nome";
  const inicial = (nome[0] ?? "?").toUpperCase();
  const proximoExpirar =
    c.janela_expira_em &&
    new Date(c.janela_expira_em).getTime() - Date.now() < 3 * 60 * 60 * 1000 &&
    new Date(c.janela_expira_em).getTime() > Date.now();

  return (
    <Link to="/quitamany/conversa/$id" params={{ id: c.id }}>
      <Card className="flex items-center gap-3 border-transparent p-3 shadow-[var(--shadow-card)] transition hover:border-primary/20">
        <Avatar className="h-12 w-12 shrink-0">
          {c.contatos?.foto_url ? <AvatarImage src={c.contatos.foto_url} alt={nome} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary">{inicial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{c.contatos?.username ? `@${c.contatos.username}` : nome}</p>
            <ModeChip modo={c.modo} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.ultima_mensagem || "Sem mensagens"}</p>
          {proximoExpirar ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-warning-foreground">
              <Clock className="h-3 w-3" /> Janela de 24h termina em breve
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          {c.ultima_msg_em ? (
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(c.ultima_msg_em), { locale: ptBR, addSuffix: false })}
            </span>
          ) : null}
          {c.nao_lidas > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{c.nao_lidas}</span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

export function ModeChip({ modo }: { modo: "automatico" | "humano" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        modo === "automatico"
          ? "bg-primary/10 text-primary"
          : "bg-success/15 text-success-foreground",
      )}
    >
      {modo === "automatico" ? <><Bot className="h-3 w-3" /> Auto</> : <><UserCheck className="h-3 w-3" /> Com você</>}
    </span>
  );
}

function EmptyState() {
  return (
    <Card className="mx-2 my-4 border-dashed border-2 border-border bg-transparent p-8 text-center shadow-none">
      <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">Nenhuma conversa ainda</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Quando alguém mandar DM ou comentar num post, ela aparece aqui.
      </p>
    </Card>
  );
}
