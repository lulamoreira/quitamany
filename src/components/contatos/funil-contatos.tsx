import { useMemo, useState } from "react";
import { formatRelative } from "@/lib/format-date";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-desktop";
import { Sparkles, User2, FileText, ShoppingBag, HelpCircle } from "lucide-react";

type Contato = {
  id: string;
  username: string | null;
  nome: string | null;
  foto_url: string | null;
  etiquetas: string[] | null;
  ultima_interacao: string;
};

const STAGES: Array<{ key: string; label: string; icon: any; tone: string }> = [
  { key: "__sem__", label: "Sem etiqueta", icon: HelpCircle, tone: "text-muted-foreground" },
  { key: "novo", label: "Novo", icon: Sparkles, tone: "text-blue-600 dark:text-blue-400" },
  { key: "lead", label: "Lead", icon: User2, tone: "text-violet-600 dark:text-violet-400" },
  { key: "orçamento enviado", label: "Orçamento enviado", icon: FileText, tone: "text-amber-600 dark:text-amber-400" },
  { key: "cliente", label: "Cliente", icon: ShoppingBag, tone: "text-emerald-600 dark:text-emerald-400" },
];

const STAGE_KEYS = STAGES.filter((s) => s.key !== "__sem__").map((s) => s.key);

function stageOf(c: Contato): string {
  const tags = (c.etiquetas ?? []).map((t) => t.toLowerCase().trim());
  for (const s of STAGE_KEYS) if (tags.includes(s)) return s;
  return "__sem__";
}

export function FunilContatos({
  contatos,
  onOpenContato,
}: {
  contatos: Contato[];
  onOpenContato: (id: string) => void;
}) {
  const qc = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byStage = useMemo(() => {
    const m: Record<string, Contato[]> = {};
    STAGES.forEach((s) => (m[s.key] = []));
    for (const c of contatos) m[stageOf(c)]?.push(c);
    return m;
  }, [contatos]);

  const activeContato = contatos.find((c) => c.id === activeId) || null;

  const move = async (c: Contato, target: string) => {
    const current = stageOf(c);
    if (current === target) return;
    const semStages = (c.etiquetas ?? []).filter(
      (t) => !STAGE_KEYS.includes(t.toLowerCase().trim()),
    );
    const nova = target === "__sem__" ? semStages : [...semStages, target];

    const prev = qc.getQueryData<Contato[]>(["qm-contatos"]);
    if (prev) {
      qc.setQueryData<Contato[]>(["qm-contatos"], (list) =>
        (list ?? []).map((x) => (x.id === c.id ? { ...x, etiquetas: nova } : x)),
      );
    }
    const { error } = await (supabase as any)
      .from("contatos")
      .update({ etiquetas: nova })
      .eq("id", c.id);
    if (error) {
      qc.setQueryData(["qm-contatos"], prev);
      toast.error("Falha ao mover contato: " + error.message);
      return;
    }
    const stageLabel = STAGES.find((s) => s.key === target)?.label ?? target;
    toast.success(`${c.username ? "@" + c.username : c.nome ?? "Contato"} → ${stageLabel}`);
    qc.invalidateQueries({ queryKey: ["qm-contatos"] });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={(e: DragEndEvent) => {
        setActiveId(null);
        const c = contatos.find((x) => x.id === e.active.id);
        const target = e.over?.id as string | undefined;
        if (c && target) move(c, target);
      }}
    >
      <div className="grid grid-cols-5 gap-3">
        {STAGES.map((s) => (
          <FunilCol
            key={s.key}
            stage={s}
            contatos={byStage[s.key] ?? []}
            activeId={activeId}
            onOpen={onOpenContato}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={reduced ? null : { duration: 180 }}>
        {activeContato ? <ContatoCardVisual c={activeContato} elevated /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function FunilCol({
  stage,
  contatos,
  activeId,
  onOpen,
}: {
  stage: (typeof STAGES)[number];
  contatos: Contato[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.key });
  const Icon = stage.icon;
  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon className={cn("h-4 w-4", stage.tone)} />
        <h3 className="text-sm font-bold">{stage.label}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {contatos.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-2xl border border-dashed p-2 transition-colors",
          isOver ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/30",
        )}
      >
        {contatos.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Vazio</p>
        ) : (
          contatos.map((c) => (
            <DraggableContato key={c.id} c={c} dragging={activeId === c.id} onOpen={() => onOpen(c.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableContato({ c, dragging, onOpen }: { c: Contato; dragging: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onDoubleClick={onOpen}
      className={cn(
        "touch-none cursor-grab active:cursor-grabbing",
        (dragging || isDragging) && "opacity-40",
      )}
    >
      <ContatoCardVisual c={c} />
    </div>
  );
}

function ContatoCardVisual({ c, elevated }: { c: Contato; elevated?: boolean }) {
  const nome = c.nome || c.username || "Sem nome";
  const inicial = (nome[0] ?? "?").toUpperCase();
  return (
    <Card
      className={cn(
        "border-border/60 p-2 shadow-[var(--shadow-card)]",
        elevated && "rotate-1 scale-[1.02] shadow-xl ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="h-9 w-9 shrink-0">
          {c.foto_url ? <AvatarImage src={c.foto_url} alt={nome} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{inicial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{c.username ? `@${c.username}` : nome}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {formatRelative(c.ultima_interacao, { addSuffix: true })}
          </p>
        </div>
      </div>
    </Card>
  );
}
