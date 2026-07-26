import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Bot, UserCheck, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Conversas</h1>
        <p className="text-sm text-muted-foreground">Inbox ao vivo do Instagram Direct.</p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : !conversas || conversas.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {conversas.map((c) => (
            <ConversaCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
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
    <Card className="border-dashed border-2 border-border bg-transparent p-8 text-center shadow-none">
      <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">Nenhuma conversa ainda</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Quando alguém mandar DM ou comentar num post, ela aparece aqui.
      </p>
    </Card>
  );
}
