import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { FileText, CalendarClock, CheckCircle2, AlertTriangle, Ban, Loader2, ExternalLink } from "lucide-react";
import { PostActions, StatusBadge } from "./post-actions";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-desktop";

type Post = {
  id: string;
  titulo: string | null;
  legenda: string | null;
  hashtags: string | null;
  status: "rascunho" | "agendado" | "processando" | "publicado" | "erro";
  agendado_para: string | null;
  video_url: string | null;
  erro_msg: string | null;
  permalink: string | null;
  instagram_permalink: string | null;
};

type ColKey = "rascunho" | "agendado" | "publicado" | "erro";

const COLS: Array<{ key: ColKey; label: string; icon: any; tone: string; ring: string }> = [
  { key: "rascunho", label: "Rascunho", icon: FileText, tone: "text-muted-foreground", ring: "ring-border" },
  { key: "agendado", label: "Agendado", icon: CalendarClock, tone: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/30" },
  { key: "publicado", label: "Publicado", icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30" },
  { key: "erro", label: "Erro", icon: AlertTriangle, tone: "text-red-600 dark:text-red-400", ring: "ring-red-500/30" },
];

export function AgendaKanban({ posts }: { posts: Post[] }) {
  const qc = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  // popover state for date/time on rascunho→agendado, erro→agendado
  const [pendingReschedule, setPendingReschedule] = useState<{ post: Post; anchor?: DOMRect } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const byCol = useMemo(() => {
    const m: Record<ColKey, Post[]> = { rascunho: [], agendado: [], publicado: [], erro: [] };
    for (const p of posts) {
      const target: ColKey =
        p.status === "processando" ? "agendado" :
        (p.status as ColKey);
      if (m[target]) m[target].push(p);
    }
    // ordenar agendado por data
    m.agendado.sort((a, b) => (a.agendado_para ?? "").localeCompare(b.agendado_para ?? ""));
    return m;
  }, [posts]);

  const activePost = posts.find((p) => p.id === activeId) || null;

  const applyMove = async (post: Post, target: ColKey, dateISO?: string | null) => {
    // optimistic
    const prev = qc.getQueryData<Post[]>(["posts-agendados"]);
    if (prev) {
      qc.setQueryData<Post[]>(["posts-agendados"], (list) =>
        (list ?? []).map((p) =>
          p.id === post.id
            ? {
                ...p,
                status: target === "publicado" ? p.status : target,
                agendado_para: dateISO ?? (target === "rascunho" ? null : p.agendado_para),
              }
            : p,
        ),
      );
    }

    const patch: Record<string, any> = {};
    if (target === "rascunho") {
      patch.status = "rascunho";
      patch.agendado_para = null;
    } else if (target === "agendado") {
      patch.status = "agendado";
      patch.agendado_para = dateISO ?? post.agendado_para;
      patch.erro_msg = null;
    } else if (target === "erro") {
      // sem UI de erro manual; ignora
      return;
    }

    const { error } = await (supabase as any).from("posts_agendados").update(patch).eq("id", post.id);
    if (error) {
      qc.setQueryData(["posts-agendados"], prev);
      toast.error("Não foi possível mover: " + error.message);
      return;
    }
    toast.success(
      target === "rascunho" ? "Desagendado" :
      target === "agendado" ? `Agendado para ${format(new Date(dateISO ?? post.agendado_para ?? Date.now()), "dd/MM 'às' HH:mm", { locale: ptBR })}` :
      "Atualizado",
    );
    qc.invalidateQueries({ queryKey: ["posts-agendados"] });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as ColKey | undefined;
    const post = posts.find((p) => p.id === e.active.id);
    if (!post || !overId) return;
    const fromCol: ColKey =
      post.status === "processando" ? "agendado" : (post.status as ColKey);
    if (fromCol === overId) return;

    // regras
    if (overId === "publicado") {
      toast.error("Publicado é somente-leitura. Publique pela Meta ou aguarde o motor.");
      return;
    }
    if (post.status === "publicado") {
      toast.error("Posts publicados não podem sair da coluna.");
      return;
    }
    if (overId === "rascunho") {
      applyMove(post, "rascunho");
      return;
    }
    if (overId === "agendado") {
      // rascunho → agendado ou erro → agendado: pedir data
      setPendingReschedule({ post });
      return;
    }
  };

  return (
    <>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-4 gap-4">
          {COLS.map((col) => (
            <KanbanColumn key={col.key} col={col} posts={byCol[col.key]} activeId={activeId} />
          ))}
        </div>
        <DragOverlay dropAnimation={reduced ? null : { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {activePost ? <PostCardVisual post={activePost} elevated /> : null}
        </DragOverlay>
      </DndContext>

      <ReschedulePopover
        open={!!pendingReschedule}
        post={pendingReschedule?.post ?? null}
        onCancel={() => setPendingReschedule(null)}
        onConfirm={(iso) => {
          const p = pendingReschedule?.post;
          setPendingReschedule(null);
          if (p) applyMove(p, "agendado", iso);
        }}
      />
    </>
  );
}

function KanbanColumn({
  col,
  posts,
  activeId,
}: {
  col: (typeof COLS)[number];
  posts: Post[];
  activeId: string | null;
}) {
  const isPublicado = col.key === "publicado";
  const { isOver, setNodeRef } = useDroppable({ id: col.key });
  const Icon = col.icon;

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", col.tone)} />
          <h3 className="text-sm font-bold">{col.label}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {posts.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-2xl border border-dashed p-2 transition-colors",
          isOver && !isPublicado && "bg-primary/5 border-primary/40",
          isOver && isPublicado && "bg-destructive/5 border-destructive/40",
          !isOver && "bg-muted/30 border-border/60",
        )}
      >
        {isOver && isPublicado && (
          <div className="pointer-events-none flex items-center justify-center gap-2 rounded-xl bg-destructive/10 p-2 text-xs font-semibold text-destructive">
            <Ban className="h-3.5 w-3.5" /> Somente-leitura
          </div>
        )}
        {posts.length === 0 ? (
          <EmptyCol label={col.label} />
        ) : (
          posts.map((p) => (
            <DraggablePost key={p.id} post={p} dragging={activeId === p.id} isPublicado={isPublicado} />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyCol({ label }: { label: string }) {
  const msgs: Record<string, string> = {
    "Rascunho": "Nenhum rascunho — crie um post!",
    "Agendado": "Nada agendado ainda.",
    "Publicado": "Nenhum post publicado.",
    "Erro": "Sem erros. 🎉",
  };
  return (
    <p className="py-10 text-center text-xs text-muted-foreground">{msgs[label] ?? "Vazio"}</p>
  );
}

function DraggablePost({ post, dragging, isPublicado }: { post: Post; dragging: boolean; isPublicado: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: post.id,
    disabled: isPublicado, // publicado não sai
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none",
        isPublicado ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        (dragging || isDragging) && "opacity-40",
      )}
    >
      <PostCardVisual post={post} />
    </div>
  );
}

function PostCardVisual({ post, elevated }: { post: Post; elevated?: boolean }) {
  const hashtags = (post.hashtags ?? "").split(/\s+/).filter((h) => h.startsWith("#")).slice(0, 3);
  const igLink = post.status === "publicado" ? post.instagram_permalink : null;
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/60 bg-card p-2 shadow-[var(--shadow-card)] transition-shadow",
        elevated && "rotate-1 scale-[1.02] shadow-xl ring-2 ring-primary/30",
      )}
    >
      {igLink && (
        <a
          href={igLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          title="Abrir no Instagram"
          aria-label="Abrir no Instagram"
          className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border hover:text-primary hover:ring-primary/50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <div className="flex gap-2">
        {post.video_url ? (
          <video src={post.video_url} muted className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold leading-tight">
            {post.titulo || post.legenda?.slice(0, 60) || "Sem título"}
          </p>
          {post.agendado_para && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {format(new Date(post.agendado_para), "dd MMM · HH:mm", { locale: ptBR })}
            </p>
          )}
          {post.status === "erro" && post.erro_msg && (
            <p className="mt-1 line-clamp-1 text-[10px] font-medium text-destructive">{post.erro_msg}</p>
          )}
        </div>
      </div>
      {hashtags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {hashtags.map((h) => (
            <span key={h} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
              {h}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReschedulePopover({
  open,
  post,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  post: Post | null;
  onCancel: () => void;
  onConfirm: (iso: string) => void;
}) {
  const [dt, setDt] = useState<string>(() => {
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });

  const preset = (offsetDays: number, hour: number) => {
    const d = addDays(new Date(), offsetDays);
    d.setHours(hour, 0, 0, 0);
    setDt(format(d, "yyyy-MM-dd'T'HH:mm"));
  };

  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <Card
        className="w-full max-w-sm space-y-3 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-sm font-bold">Quando publicar?</h3>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {post.titulo || post.legenda?.slice(0, 50)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => preset(0, 12)}>Hoje 12h</Button>
          <Button size="sm" variant="outline" onClick={() => preset(0, 19)}>Hoje 19h</Button>
          <Button size="sm" variant="outline" onClick={() => preset(1, 12)}>Amanhã 12h</Button>
        </div>
        <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={() => onConfirm(new Date(dt).toISOString())}>Agendar</Button>
        </div>
      </Card>
    </div>
  );
}
