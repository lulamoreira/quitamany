import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, Zap, MessageSquare, Sparkles, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({ meta: [{ title: "Automações · QuitaMany" }] }),
  component: AutomacoesPage,
});

type Automacao = {
  id: string;
  nome: string;
  tipo: "gatilho_comentario" | "palavra_chave_dm" | "boas_vindas";
  ativa: boolean;
  palavras: string[];
  post_ig_id: string | null;
  resposta_comentario: string | null;
  resposta_dm: string;
  botoes: Array<{ titulo: string }>;
  etiqueta_aplicar: string | null;
  execucoes: number;
};

const TIPO_LABEL = {
  gatilho_comentario: "Comentário → DM",
  palavra_chave_dm: "Palavra-chave no DM",
  boas_vindas: "Boas-vindas",
};

function AutomacoesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Automacao | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: autos, isLoading } = useQuery({
    queryKey: ["qm-automacoes"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("automacoes").select("*").order("criado_em", { ascending: false });
      return (data as Automacao[]) ?? [];
    },
  });

  const toggle = async (a: Automacao) => {
    await (supabase as any).from("automacoes").update({ ativa: !a.ativa }).eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["qm-automacoes"] });
  };

  const remover = async (a: Automacao) => {
    if (!confirm(`Excluir automação "${a.nome}"?`)) return;
    await (supabase as any).from("automacoes").delete().eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["qm-automacoes"] });
    toast.success("Automação removida");
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automações</h1>
          <p className="text-sm text-muted-foreground">Robôs que respondem por você.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nova
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : !autos || autos.length === 0 ? (
        <Card className="border-2 border-dashed p-8 text-center shadow-none">
          <Zap className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">Nenhuma automação</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie a primeira regra e economize tempo.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {autos.map((a) => (
            <Card key={a.id} className="border-transparent p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      {TIPO_LABEL[a.tipo]}
                    </span>
                    {a.ativa ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success-foreground">Ativa</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Pausada</span>
                    )}
                  </div>
                  <h3 className="mt-1 font-semibold">{a.nome}</h3>
                  {a.palavras.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.palavras.map((p) => (
                        <span key={p} className="rounded-full bg-accent px-2 py-0.5 text-[11px]">{p}</span>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">Executada {a.execucoes} {a.execucoes === 1 ? "vez" : "vezes"}</p>
                </div>
                <Switch checked={a.ativa} onCheckedChange={() => toggle(a)} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                  <Pencil className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remover(a)}>
                  <Trash2 className="mr-1 h-3 w-3" /> Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <EditorDialog
          automacao={editing}
          open={!!(editing || creating)}
          onOpenChange={(v) => { if (!v) { setEditing(null); setCreating(false); } }}
          onSaved={() => { setEditing(null); setCreating(false); qc.invalidateQueries({ queryKey: ["qm-automacoes"] }); }}
        />
      )}
    </div>
  );
}

function EditorDialog({ automacao, open, onOpenChange, onSaved }: {
  automacao: Automacao | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(automacao?.nome ?? "");
  const [tipo, setTipo] = useState<Automacao["tipo"]>(automacao?.tipo ?? "palavra_chave_dm");
  const [palavras, setPalavras] = useState<string[]>(automacao?.palavras ?? []);
  const [palavraInput, setPalavraInput] = useState("");
  const [postIgId, setPostIgId] = useState(automacao?.post_ig_id ?? "");
  const [respostaComentario, setRespostaComentario] = useState(automacao?.resposta_comentario ?? "");
  const [respostaDm, setRespostaDm] = useState(automacao?.resposta_dm ?? "");
  const [botoes, setBotoes] = useState<Array<{ titulo: string }>>(automacao?.botoes ?? []);
  const [botaoInput, setBotaoInput] = useState("");
  const [etiqueta, setEtiqueta] = useState(automacao?.etiqueta_aplicar ?? "");
  const [saving, setSaving] = useState(false);

  const addPalavra = () => {
    const p = palavraInput.trim();
    if (p && !palavras.includes(p)) setPalavras([...palavras, p]);
    setPalavraInput("");
  };
  const addBotao = () => {
    const t = botaoInput.trim();
    if (t && botoes.length < 3) setBotoes([...botoes, { titulo: t }]);
    setBotaoInput("");
  };

  const salvar = async () => {
    if (!nome.trim() || !respostaDm.trim()) {
      toast.error("Nome e resposta DM são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      tipo,
      palavras,
      post_ig_id: postIgId.trim() || null,
      resposta_comentario: tipo === "gatilho_comentario" ? respostaComentario.trim() || null : null,
      resposta_dm: respostaDm.trim(),
      botoes,
      etiqueta_aplicar: etiqueta.trim() || null,
    };
    if (automacao) {
      await (supabase as any).from("automacoes").update(payload).eq("id", automacao.id);
    } else {
      await (supabase as any).from("automacoes").insert({ ...payload, ativa: true });
    }
    setSaving(false);
    toast.success(automacao ? "Automação atualizada" : "Automação criada");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{automacao ? "Editar automação" : "Nova automação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Promo do mês" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gatilho_comentario">Comentário → DM</SelectItem>
                <SelectItem value="palavra_chave_dm">Palavra-chave no DM</SelectItem>
                <SelectItem value="boas_vindas">Boas-vindas (primeira DM)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo !== "boas_vindas" && (
            <div>
              <Label>Palavras-chave</Label>
              <div className="flex gap-2">
                <Input value={palavraInput} onChange={(e) => setPalavraInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPalavra(); } }}
                  placeholder="palavra e Enter" />
                <Button variant="outline" size="sm" onClick={addPalavra}>Adicionar</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {palavras.map((p) => (
                  <button key={p} onClick={() => setPalavras(palavras.filter((x) => x !== p))}
                    className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs">
                    {p} <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipo === "gatilho_comentario" && (
            <>
              <div>
                <Label>Post específico (ID) — vazio = todos os posts</Label>
                <Input value={postIgId} onChange={(e) => setPostIgId(e.target.value)} placeholder="ig media id (opcional)" />
              </div>
              <div>
                <Label>Resposta pública no comentário</Label>
                <Textarea value={respostaComentario} onChange={(e) => setRespostaComentario(e.target.value)} rows={2} />
              </div>
            </>
          )}

          <div>
            <Label>Resposta por DM</Label>
            <Textarea value={respostaDm} onChange={(e) => setRespostaDm(e.target.value)} rows={4} />
            <p className="mt-2 text-xs text-muted-foreground">Preview:</p>
            <div className="mt-1 max-w-[85%] rounded-2xl rounded-bl-sm bg-bubble-in px-3 py-2 text-sm text-bubble-in-foreground">
              <span className="mr-1 text-[10px] opacity-75">🤖</span>
              <span className="whitespace-pre-wrap">{respostaDm || "sua mensagem aparece aqui"}</span>
              {botoes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {botoes.map((b) => (
                    <span key={b.titulo} className="rounded-full border border-primary/40 bg-background px-3 py-1 text-xs font-medium text-foreground">
                      {b.titulo}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Botões de resposta rápida (até 3)</Label>
            <div className="flex gap-2">
              <Input value={botaoInput} onChange={(e) => setBotaoInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBotao(); } }}
                placeholder="ex.: Catálogo" />
              <Button variant="outline" size="sm" onClick={addBotao} disabled={botoes.length >= 3}>Adicionar</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {botoes.map((b, i) => (
                <button key={i} onClick={() => setBotoes(botoes.filter((_, x) => x !== i))}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-foreground">
                  {b.titulo} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Etiqueta a aplicar no contato (opcional)</Label>
            <Input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="ex.: lead" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
