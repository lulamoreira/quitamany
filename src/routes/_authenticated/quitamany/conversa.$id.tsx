import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { ArrowLeft, Send, Bot, UserCheck, Tag, StickyNote, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { enviarMensagem, alterarModo, marcarLida } from "@/lib/quitamany.functions";

export const Route = createFileRoute("/_authenticated/quitamany/conversa/$id")({
  head: () => ({ meta: [{ title: "Conversa · QuitaMany" }] }),
  component: ConversaPage,
});

function ConversaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enviar = useServerFn(enviarMensagem);
  const trocarModo = useServerFn(alterarModo);
  const marcar = useServerFn(marcarLida);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversa } = useQuery({
    queryKey: ["qm-conversa", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conversas")
        .select("*, contatos(*)")
        .eq("id", id)
        .single();
      return data as any;
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
      .channel(`qm-conv-${id}`)
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

  const contato = conversa?.contatos;
  const nome = contato?.nome || contato?.username || "Contato";
  const inicial = (nome[0] ?? "?").toUpperCase();
  const janelaExpirou =
    conversa?.janela_expira_em && new Date(conversa.janela_expira_em).getTime() < Date.now();

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

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      {/* Header */}
      <Card className="mb-3 flex items-center gap-3 border-transparent p-3 shadow-[var(--shadow-card)]">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/quitamany" })}>
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

      {/* Contato panel colapsado */}
      {contato ? <ContatoPanel contato={contato} onChanged={() => qc.invalidateQueries({ queryKey: ["qm-conversa", id] })} /> : null}

      {/* Mensagens */}
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
                  {formatDistanceToNow(new Date(m.criado_em), { locale: ptBR, addSuffix: true })}
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

function ContatoPanel({ contato, onChanged }: { contato: any; onChanged: () => void }) {
  const [novaTag, setNovaTag] = useState("");
  const [notas, setNotas] = useState(contato.notas ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [open, setOpen] = useState(false);

  const addTag = async () => {
    if (!novaTag.trim()) return;
    const atuais: string[] = contato.etiquetas ?? [];
    if (atuais.includes(novaTag.trim())) return;
    await (supabase as any).from("contatos").update({ etiquetas: [...atuais, novaTag.trim()] }).eq("id", contato.id);
    setNovaTag("");
    onChanged();
  };
  const removeTag = async (t: string) => {
    const atuais: string[] = contato.etiquetas ?? [];
    await (supabase as any).from("contatos").update({ etiquetas: atuais.filter((x) => x !== t) }).eq("id", contato.id);
    onChanged();
  };
  const salvarNotas = async () => {
    setSavingNotes(true);
    await (supabase as any).from("contatos").update({ notas }).eq("id", contato.id);
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
              {(contato.etiquetas ?? []).map((t: string) => (
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
