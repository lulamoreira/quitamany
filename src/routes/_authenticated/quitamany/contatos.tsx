import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/quitamany/contatos")({
  head: () => ({ meta: [{ title: "Contatos · QuitaMany" }] }),
  component: ContatosPage,
});

type Contato = {
  id: string;
  username: string | null;
  nome: string | null;
  foto_url: string | null;
  etiquetas: string[];
  ultima_interacao: string;
};

function ContatosPage() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);

  const { data: contatos, isLoading } = useQuery({
    queryKey: ["qm-contatos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("contatos").select("*").order("ultima_interacao", { ascending: false });
      return (data as Contato[]) ?? [];
    },
  });

  const etiquetasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (contatos ?? []).forEach((c) => c.etiquetas?.forEach((t) => s.add(t)));
    return Array.from(s);
  }, [contatos]);

  const filtrados = useMemo(() => {
    return (contatos ?? []).filter((c) => {
      if (filtro && !(c.etiquetas ?? []).includes(filtro)) return false;
      if (busca) {
        const q = busca.toLowerCase();
        return (c.username ?? "").toLowerCase().includes(q) || (c.nome ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [contatos, busca, filtro]);

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
        <p className="text-sm text-muted-foreground">Todo mundo que interagiu com você.</p>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por @usuário ou nome" className="pl-9" />
      </div>

      {etiquetasDisponiveis.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setFiltro(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${!filtro ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
            Todos
          </button>
          {etiquetasDisponiveis.map((t) => (
            <button key={t} onClick={() => setFiltro(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${filtro === t ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="border-2 border-dashed p-8 text-center shadow-none">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">Nenhum contato ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">Quando alguém interagir, aparece aqui.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map((c) => {
            const nome = c.nome || c.username || "Sem nome";
            const inicial = nome[0]?.toUpperCase() ?? "?";
            return (
              <Card key={c.id} className="flex items-center gap-3 border-transparent p-3 shadow-[var(--shadow-card)]">
                <Avatar className="h-11 w-11">
                  {c.foto_url ? <AvatarImage src={c.foto_url} alt={nome} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary">{inicial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.username ? `@${c.username}` : nome}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {(c.etiquetas ?? []).map((t) => (
                      <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t}</span>
                    ))}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.ultima_interacao), { locale: ptBR, addSuffix: true })}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
