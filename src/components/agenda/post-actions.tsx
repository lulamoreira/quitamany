import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Pencil, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type PostLite = {
  id: string;
  titulo: string | null;
  legenda: string | null;
  hashtags: string | null;
  status: string;
  agendado_para: string | null;
  publicado_em?: string | null;
  video_url: string | null;
  erro_msg: string | null;
  permalink?: string | null;
  instagram_permalink?: string | null;
};

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  processando: "Processando",
  publicado: "Publicado",
  erro: "Erro",
};

export const STATUS_STYLES: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  agendado: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  processando: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  publicado: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  erro: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", STATUS_STYLES[status] ?? "", className)}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const stopAll = {
  onClick: (e: React.MouseEvent) => e.stopPropagation(),
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
};

export function PostActions({
  post,
  invalidateKeys = [["posts-agendados"], ["historico"]],
  compact = false,
}: {
  post: PostLite;
  invalidateKeys?: (readonly unknown[])[];
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [preview, setPreview] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isPublicado = post.status === "publicado";
  const canDelete = !isPublicado;
  const canEdit = post.status === "rascunho" || post.status === "agendado" || post.status === "erro";

  const goEdit = () => {
    navigate({ to: "/novo", search: { id: post.id } as any });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("posts_agendados").delete().eq("id", post.id);
      if (error) throw error;
      toast.success("Post excluído.");
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k as any }));
      setConfirmDel(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  const size = compact ? "h-6 w-6" : "h-7 w-7";
  const icon = compact ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <>
      <div className="flex items-center gap-1" {...stopAll}>
        <button
          type="button"
          onClick={() => setPreview(true)}
          title="Visualizar"
          aria-label="Visualizar"
          className={cn(
            "flex items-center justify-center rounded-md text-muted-foreground ring-1 ring-border bg-background/80 hover:text-primary hover:ring-primary/50",
            size,
          )}
        >
          <Eye className={icon} />
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={goEdit}
            title="Editar"
            aria-label="Editar"
            className={cn(
              "flex items-center justify-center rounded-md text-muted-foreground ring-1 ring-border bg-background/80 hover:text-primary hover:ring-primary/50",
              size,
            )}
          >
            <Pencil className={icon} />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            title="Excluir"
            aria-label="Excluir"
            className={cn(
              "flex items-center justify-center rounded-md text-muted-foreground ring-1 ring-border bg-background/80 hover:text-destructive hover:ring-destructive/50",
              size,
            )}
          >
            <Trash2 className={icon} />
          </button>
        )}
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent
          className="max-w-lg"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base">
                {post.titulo || post.legenda?.slice(0, 60) || "Sem título"}
              </DialogTitle>
              <StatusBadge status={post.status} />
            </div>
            <DialogDescription>
              {post.publicado_em
                ? `Publicado em ${format(new Date(post.publicado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                : post.agendado_para
                  ? `Agendado para ${format(new Date(post.agendado_para), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                  : "Rascunho"}
            </DialogDescription>
          </DialogHeader>

          {post.video_url ? (
            <video
              src={post.video_url}
              controls
              className="max-h-[50vh] w-full rounded-lg bg-black object-contain"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
              Sem vídeo anexado
            </div>
          )}

          {post.legenda && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Legenda</p>
              <p className="whitespace-pre-wrap text-sm">{post.legenda}</p>
            </div>
          )}
          {post.hashtags && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Hashtags</p>
              <p className="text-sm text-primary">{post.hashtags}</p>
            </div>
          )}
          {post.status === "erro" && post.erro_msg && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {post.erro_msg}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {(post.instagram_permalink || post.permalink) && (
              <Button asChild size="sm" variant="outline">
                <a
                  href={(post.instagram_permalink || post.permalink) as string}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Ver no Instagram
                </a>
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setPreview(false);
                  goEdit();
                }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este post?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O post{" "}
              <span className="font-medium">
                {post.titulo || post.legenda?.slice(0, 40) || "sem título"}
              </span>{" "}
              será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
