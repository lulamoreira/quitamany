import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ArrowLeft, Send, Bot, UserCheck, Tag, StickyNote, Loader2, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format-date";
import { enviarMensagem, alterarModo, marcarLida } from "@/lib/quitamany.functions";
import { useIsDesktop } from "@/hooks/use-desktop";

export const Route = createFileRoute("/_authenticated/conversa/$id")({
  head: () => ({ meta: [{ title: "Conversa · QuitaMany" }] }),
  component: ConversaPage,
});

function ConversaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();
  const enviar = useServerFn(enviarMensagem);
  const trocarModo = useServerFn(alterarModo);
  const marcar = useServerFn(marcarLida);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversa, isLoading: loadingConversa } = useQuery({
    queryKey: ["qm-conversa", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conversas")
        .select("*, contatos(*)")
        .eq("id", id)
        .maybeSingle();
      return (data as any) ?? null;
    },
  });

  const { data: mensagens } = useQuery({
    queryKey: ["qm-mensagens", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("mensagens")
        .select("*")
        .eq("conversa_id", id)
        .order("criado_em", { ascending: true });
      return (data as any[]) ?? [];
    },
  });

  useEffect(() => {
    marcar({ data: { conversa_id: id } }).catch(() => {});
    const ch = supabase
      .channel(`qm-conv-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens", filter: `conversa_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["qm-mensagens", id] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversas", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["qm-conversa", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc, marcar]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  const contato = conversa?.contatos ?? null;
  const nome = contato?.nome || contato?.username || "Contato";
  const inicial = ((nome?.[0] ?? "?") as string).toUpperCase();
  const janelaExpirou =
    !!conversa?.janela_expira_em && new Date(conversa.janela_expira_em).getTime() < Date.now();

  const handleEnviar = async () => {
    if (!texto.trim() || sending) return;
    setSending(true);
    const res: any = await enviar({ data: { conversa_id: id, texto: texto.trim() } });
    setSending(false);
    if (res?.ok) {
      setTexto("");
      qc.invalidateQueries({ queryKey: ["qm-mensagens", id] });
    } else {
      toast.error(res?.error || "Não foi possível enviar");
    }
  };

  const handleModo = async (modo: "automatico" | "humano") => {
    const res: any = await trocarModo({ data: { conversa_id: id, modo } });
    if (res?.ok) {
      toast.success(modo === "humano" ? "Você assumiu a conversa" : "Robô retomou a conversa");
      qc.invalidateQueries({ queryKey: ["qm-conversa", id] });
    }
  };

  // Loading / not-found guards — evitar TypeError antes das queries carregarem
  if (loadingConversa) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!conversa) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">Conversa não encontrada.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/conversas" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para conversas
        </Button>
      </div>
    );
  }

  // ---- Desktop: 3 colunas (lista | chat | painel do contato) ----
  if (isDesktop) {
    return (
      <div className="grid h-screen grid-cols-[320px_1fr_320px] overflow-hidden">
        <ConversaSidebarList activeId={id} />

        <section className="flex min-w-0 flex-col bg-muted/20">
          {/* Header do chat */}
          <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
            <Avatar className="h-10 w-10">
              {contato?.foto_url ? <AvatarImage src={contato.foto_url} alt={nome} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{inicial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {contato?.username ? `@${contato.username}` : nome}
                {contato?.opt_out ? (
                  <span className="ml-2 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">Opt-out</span>
                ) : null}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {conversa?.modo === "automatico" ? "🤖 Modo automático" : "👤 Você está respondendo"}
              </p>
            </div>
            {conversa?.modo === "automatico" ? (
              <Button size="sm" onClick={() => handleModo("humano")}>
                <UserCheck className="mr-1 h-4 w-4" /> Assumir
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleModo("automatico")}>
                <Bot className="mr-1 h-4 w-4" /> Devolver ao robô
              </Button>
            )}
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-6">
            {(mensagens ?? []).map((m) => {
              const isOut = m.direcao === "enviada";
              return (
                <div key={m.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[65%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                      isOut
                        ? "rounded-br-sm bg-bubble-out text-bubble-out-foreground"
                        : "rounded-bl-sm bg-bubble-in text-bubble-in-foreground",
                    )}
                  >
                    {isOut && m.enviada_por === "robo" ? (
                      <span className="mr-1 text-[10px] opacity-75">🤖</span>
                    ) : null}
                    <span className="whitespace-pre-wrap">{m.texto}</span>
                    <div className={cn("mt-1 text-[10px]", isOut ? "text-white/70" : "text-muted-foreground")}>
                      {formatRelative(m.criado_em, { addSuffix: true })}
                    </div>
                  </div>
                </div>
              );
            })}
            {(mensagens ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
            ) : null}
          </div>

          {/* Composer */}
          <div className="border-t bg-card p-3">
            {janelaExpirou ? (
              <p className="p-2 text-center text-xs text-muted-foreground">
                Janela de 24h expirada — aguarde o cliente mandar mensagem para responder.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Escreva uma resposta… (Enter envia, Shift+Enter quebra linha)"
                  rows={1}
                  className="min-h-[40px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); }
                  }}
                />
                <Button size="icon" onClick={handleEnviar} disabled={sending || !texto.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Painel direito */}
        <aside className="overflow-y-auto border-l bg-card p-4">
          {contato ? (
            <ContatoPanelDesktop
              contato={contato}
              conversaId={id}
              onChanged={() => qc.invalidateQueries({ queryKey: ["qm-conversa", id] })}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Sem dados do contato.</p>
          )}
        </aside>
      </div>
    );
  }

  // ---- Mobile (inalterado) ----
  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <Card className="mb-3 flex items-center gap-3 border-transparent p-3 shadow-[var(--shadow-card)]">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/conversas" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          {contato?.foto_url ? <AvatarImage src={contato.foto_url} alt={nome} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary">{inicial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{contato?.username ? `@${contato.username}` : nome}</p>
          <p className="truncate text-xs text-muted-foreground">
            {conversa?.modo === "automatico" ? "Modo automático" : "Você está respondendo"}
          </p>
        </div>
        {conversa?.modo === "automatico" ? (
          <Button size="sm" onClick={() => handleModo("humano")}>
            <UserCheck className="mr-1 h-4 w-4" /> Assumir
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => handleModo("automatico")}>
            <Bot className="mr-1 h-4 w-4" /> Devolver ao robô
          </Button>
        )}
      </Card>

      {contato ? <ContatoPanel contato={contato} onChanged={() => qc.invalidateQueries({ queryKey: ["qm-conversa", id] })} /> : null}

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto rounded-2xl bg-muted/30 p-3">
        {(mensagens ?? []).map((m) => {
          const isOut = m.direcao === "enviada";
          return (
            <div key={m.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                  isOut
                    ? "rounded-br-sm bg-bubble-out text-bubble-out-foreground"
                    : "rounded-bl-sm bg-bubble-in text-bubble-in-foreground",
                )}
              >
                {isOut && m.enviada_por === "robo" ? (
                  <span className="mr-1 text-[10px] opacity-75">🤖</span>
                ) : null}
                <span className="whitespace-pre-wrap">{m.texto}</span>
                <div className={cn("mt-1 text-[10px]", isOut ? "text-white/70" : "text-muted-foreground")}>
                  {formatRelative(m.criado_em, { addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
        {(mensagens ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        ) : null}
      </div>

      <Card className="mt-3 border-transparent p-2 shadow-[var(--shadow-card)]">
        {janelaExpirou ? (
          <p className="p-2 text-center text-xs text-muted-foreground">
            Janela de 24h expirada — aguarde o cliente mandar mensagem para responder.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva uma resposta…"
              rows={1}
              className="min-h-[40px] resize-none border-0 bg-transparent focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); }
              }}
            />
            <Button size="icon" onClick={handleEnviar} disabled={sending || !texto.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Lista compacta de conversas usada no painel esquerdo desktop. */
function ConversaSidebarList({ activeId }: { activeId: string }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "auto" | "humano" | "nao-lidas">("todas");
  const qc = useQueryClient();

  const { data: conversas } = useQuery({
    queryKey: ["quitamany-conversas"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conversas")
        .select("id, modo, ultima_mensagem, ultima_msg_em, nao_lidas, contatos(id, username, nome, foto_url)")
        .order("ultima_msg_em", { ascending: false, nullsFirst: false });
      return (data as any[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("qm-conversas-side")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas" }, () =>
        qc.invalidateQueries({ queryKey: ["quitamany-conversas"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtradas = (conversas ?? []).filter((c: any) => {
    if (filtro === "auto" && c.modo !== "automatico") return false;
    if (filtro === "humano" && c.modo !== "humano") return false;
    if (filtro === "nao-lidas" && (c.nao_lidas ?? 0) === 0) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return (c.contatos?.username ?? "").toLowerCase().includes(q) || (c.contatos?.nome ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
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
        {filtradas.map((c: any) => {
          const nome = c.contatos?.nome || c.contatos?.username || "Sem nome";
          const inicial = (nome[0] ?? "?").toUpperCase();
          const active = c.id === activeId;
          return (
            <Link key={c.id} to="/conversa/$id" params={{ id: c.id }}>
              <div
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 transition-colors",
                  active ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-accent/50",
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
                        {formatRelative(c.ultima_msg_em, { addSuffix: false })}
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
            </Link>
          );
        })}
        {filtradas.length === 0 && (
          <p className="p-8 text-center text-xs text-muted-foreground">Nenhuma conversa.</p>
        )}
      </div>
    </aside>
  );
}

/** Painel do contato — versão desktop (sempre aberto). */
function ContatoPanelDesktop({
  contato,
  conversaId,
  onChanged,
}: {
  contato: any;
  conversaId: string;
  onChanged: () => void;
}) {
  const [novaTag, setNovaTag] = useState("");
  const [notas, setNotas] = useState(contato?.notas ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  // histórico de automações disparadas nesta conversa
  const { data: automacoes } = useQuery({
    queryKey: ["qm-conv-automacoes", conversaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("mensagens")
        .select("id, criado_em, texto, enviada_por")
        .eq("conversa_id", conversaId)
        .eq("enviada_por", "robo")
        .order("criado_em", { ascending: false })
        .limit(10);
      return (data as any[]) ?? [];
    },
  });

    if (!contato?.id) return null;

const addTag = async () => {
    if (!novaTag.trim()) return;
    const atuais: string[] = contato?.etiquetas ?? [];
    if (atuais.includes(novaTag.trim())) return;
    await (supabase as any).from("contatos").update({ etiquetas: [...atuais, novaTag.trim()] }).eq("id", contato?.id);
    setNovaTag("");
    onChanged();
  };
  const removeTag = async (t: string) => {
    const atuais: string[] = contato?.etiquetas ?? [];
    await (supabase as any).from("contatos").update({ etiquetas: atuais.filter((x) => x !== t) }).eq("id", contato?.id);
    onChanged();
  };
  const salvarNotas = async () => {
    setSavingNotes(true);
    await (supabase as any).from("contatos").update({ notas }).eq("id", contato?.id);
    setSavingNotes(false);
    toast.success("Notas salvas");
    onChanged();
  };

  const nome = contato?.nome || contato?.username || "Contato";
  const inicial = (nome[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-5">
      <div className="text-center">
        <Avatar className="mx-auto h-16 w-16">
          {contato?.foto_url ? <AvatarImage src={contato?.foto_url} alt={nome} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{inicial}</AvatarFallback>
        </Avatar>
        <p className="mt-2 text-sm font-bold">{contato?.username ? `@${contato?.username}` : nome}</p>
        {contato?.nome && contato?.username && (
          <p className="text-xs text-muted-foreground">{contato?.nome}</p>
        )}
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Tag className="h-3 w-3" /> Etiquetas
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          {(contato?.etiquetas ?? []).map((t: string) => (
            <button
              key={t}
              onClick={() => removeTag(t)}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
            >
              {t} ×
            </button>
          ))}
          {(contato?.etiquetas ?? []).length === 0 && (
            <p className="text-[11px] text-muted-foreground">Sem etiquetas.</p>
          )}
        </div>
        <div className="flex gap-1.5">
          <Input
            value={novaTag}
            onChange={(e) => setNovaTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="nova etiqueta"
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" onClick={addTag}>+</Button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <StickyNote className="h-3 w-3" /> Notas
        </p>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={4}
          className="text-xs"
          placeholder="Anote observações sobre este contato…"
        />
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={salvarNotas} disabled={savingNotes}>
          {savingNotes ? "Salvando…" : "Salvar notas"}
        </Button>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3 w-3" /> Automações disparadas
        </p>
        {(automacoes ?? []).length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhuma automação disparada nesta conversa.</p>
        ) : (
          <ul className="space-y-1.5">
            {(automacoes ?? []).map((a: any) => (
              <li key={a.id} className="rounded-lg bg-accent/40 p-2">
                <p className="line-clamp-2 text-[11px] font-medium">{a.texto}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatRelative(a.criado_em, { addSuffix: true })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Painel do contato — versão mobile (colapsável). */
function ContatoPanel({ contato, onChanged }: { contato: any; onChanged: () => void }) {
  const [novaTag, setNovaTag] = useState("");
  const [notas, setNotas] = useState(contato?.notas ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [open, setOpen] = useState(false);

    if (!contato?.id) return null;

const addTag = async () => {
    if (!novaTag.trim()) return;
    const atuais: string[] = contato?.etiquetas ?? [];
    if (atuais.includes(novaTag.trim())) return;
    await (supabase as any).from("contatos").update({ etiquetas: [...atuais, novaTag.trim()] }).eq("id", contato?.id);
    setNovaTag("");
    onChanged();
  };
  const removeTag = async (t: string) => {
    const atuais: string[] = contato?.etiquetas ?? [];
    await (supabase as any).from("contatos").update({ etiquetas: atuais.filter((x) => x !== t) }).eq("id", contato?.id);
    onChanged();
  };
  const salvarNotas = async () => {
    setSavingNotes(true);
    await (supabase as any).from("contatos").update({ notas }).eq("id", contato?.id);
    setSavingNotes(false);
    toast.success("Notas salvas");
    onChanged();
  };

  return (
    <Card className="mb-3 border-transparent p-3 shadow-[var(--shadow-card)]">
      <button className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground" onClick={() => setOpen(!open)}>
        <Tag className="h-3 w-3" /> Painel do contato {open ? "▾" : "▸"}
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Etiquetas</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(contato?.etiquetas ?? []).map((t: string) => (
                <button key={t} onClick={() => removeTag(t)} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20">
                  {t} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={novaTag} onChange={(e) => setNovaTag(e.target.value)} placeholder="nova etiqueta" className="h-8 text-xs" />
              <Button size="sm" variant="outline" onClick={addTag}>Adicionar</Button>
            </div>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <StickyNote className="h-3 w-3" /> Notas
            </p>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="mt-1 text-xs" />
            <Button size="sm" variant="outline" className="mt-2" onClick={salvarNotas} disabled={savingNotes}>
              {savingNotes ? "Salvando…" : "Salvar notas"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
