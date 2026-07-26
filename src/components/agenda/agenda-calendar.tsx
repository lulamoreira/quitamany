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
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";
import { addMonths, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-desktop";
import { useNavigate } from "@tanstack/react-router";

type Post = {
  id: string;
  titulo: string | null;
  legenda: string | null;
  status: string;
  agendado_para: string | null;
  video_url: string | null;
};

const statusDot: Record<string, string> = {
  agendado: "bg-blue-500",
  processando: "bg-yellow-500",
  publicado: "bg-emerald-500",
  erro: "bg-red-500",
  rascunho: "bg-muted-foreground",
};

export function AgendaCalendarDesktop({ posts }: { posts: Post[] }) {
  const qc = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const grid = useMemo(() => {
    const first = startOfMonth(month);
    const start = startOfWeek(first, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(start, i));
    return days;
  }, [month]);

  const byDay = useMemo(() => {
    const m: Record<string, Post[]> = {};
    for (const p of posts) {
      if (!p.agendado_para) continue;
      const k = format(new Date(p.agendado_para), "yyyy-MM-dd");
      (m[k] ??= []).push(p);
    }
    return m;
  }, [posts]);

  const activePost = posts.find((p) => p.id === activeId) || null;

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const post = posts.find((p) => p.id === e.active.id);
    if (!post || !post.agendado_para) return;
    const overId = e.over?.id as string | undefined; // YYYY-MM-DD
    if (!overId) return;
    const oldDate = new Date(post.agendado_para);
    const oldKey = format(oldDate, "yyyy-MM-dd");
    if (oldKey === overId) return;

    // manter horário original, trocar apenas a data
    const [y, m, d] = overId.split("-").map(Number);
    const next = new Date(oldDate);
    next.setFullYear(y, m - 1, d);
    const iso = next.toISOString();

    // optimistic
    const prev = qc.getQueryData<Post[]>(["posts-agendados"]);
    if (prev) {
      qc.setQueryData<Post[]>(["posts-agendados"], (list) =>
        (list ?? []).map((p) => (p.id === post.id ? { ...p, agendado_para: iso } : p)),
      );
    }
    const { error } = await (supabase as any)
      .from("posts_agendados")
      .update({ agendado_para: iso })
      .eq("id", post.id);
    if (error) {
      qc.setQueryData(["posts-agendados"], prev);
      toast.error("Falha ao reagendar: " + error.message);
      return;
    }
    toast.success(`Reagendado para ${format(next, "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}`);
    qc.invalidateQueries({ queryKey: ["posts-agendados"] });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[180px] text-center text-base font-bold capitalize">
            {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
          </h3>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
          Hoje
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d, i) => (
            <DayCell
              key={i}
              day={d}
              currentMonth={month}
              posts={byDay[format(d, "yyyy-MM-dd")] ?? []}
              activeId={activeId}
              onCreate={() => navigate({ to: "/publicador/novo" })}
            />
          ))}
        </div>
      </Card>

      <DragOverlay dropAnimation={reduced ? null : { duration: 150 }}>
        {activePost ? (
          <div className="rotate-2 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
            {activePost.titulo || activePost.legenda?.slice(0, 30) || "Post"}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DayCell({
  day,
  currentMonth,
  posts,
  activeId,
  onCreate,
}: {
  day: Date;
  currentMonth: Date;
  posts: Post[];
  activeId: string | null;
  onCreate: () => void;
}) {
  const key = format(day, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({ id: key });
  const isCurr = isSameMonth(day, currentMonth);
  const isToday = isSameDay(day, new Date());

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative min-h-[110px] border-b border-r p-1.5 transition-colors",
        !isCurr && "bg-muted/20 text-muted-foreground/60",
        isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
            isToday && "bg-primary text-primary-foreground",
          )}
        >
          {day.getDate()}
        </span>
        {posts.length === 0 && isCurr && (
          <button
            onClick={onCreate}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            title="Criar post neste dia"
          >
            <PlusCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </button>
        )}
      </div>
      <div className="space-y-1">
        {posts.slice(0, 3).map((p) => (
          <DraggableDayPost key={p.id} post={p} dragging={activeId === p.id} />
        ))}
        {posts.length > 3 && (
          <p className="pl-1 text-[10px] font-medium text-muted-foreground">+{posts.length - 3} mais</p>
        )}
      </div>
    </div>
  );
}

function DraggableDayPost({ post, dragging }: { post: Post; dragging: boolean }) {
  const disabled = post.status === "publicado";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: post.id,
    disabled,
  });
  const dot = statusDot[post.status] ?? "bg-muted";
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none flex items-center gap-1 rounded-md bg-card px-1.5 py-1 text-[10px] font-medium shadow-sm ring-1 ring-border",
        !disabled && "cursor-grab active:cursor-grabbing hover:ring-primary/50",
        (dragging || isDragging) && "opacity-40",
      )}
      title={post.titulo || post.legenda || ""}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className="truncate">
        {format(new Date(post.agendado_para!), "HH:mm")} · {post.titulo || post.legenda?.slice(0, 20) || "Post"}
      </span>
    </div>
  );
}
