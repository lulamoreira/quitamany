import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  History,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listarTentativas, type Tentativa, type TentativaEvento } from "@/lib/tentativas";
import { cn } from "@/lib/utils";

interface HistoricoTentativasProps {
  postId: string;
  titulo?: string | null;
  /** Elemento clicável que abre o diálogo. Padrão: botão discreto. */
  trigger?: ReactNode;
}

const ESTILO: Record<
  TentativaEvento,
  { rotulo: string; icone: typeof AlertTriangle; classe: string }
> = {
  falha: { rotulo: "Falha", icone: AlertTriangle, classe: "text-destructive" },
  reenvio: { rotulo: "Reenvio", icone: RotateCcw, classe: "text-muted-foreground" },
  publicado: { rotulo: "Publicado", icone: CheckCircle2, classe: "text-emerald-600" },
  removido: { rotulo: "Removido no Instagram", icone: EyeOff, classe: "text-muted-foreground" },
};

const ETAPAS: Record<string, string> = {
  criar_container: "envio do vídeo",
  publicar: "publicação",
  processamento: "processamento na Meta",
  verificacao: "verificação",
  manual: "ação manual",
};

function Linha({ t }: { t: Tentativa }) {
  const { rotulo, icone: Icone, classe } = ESTILO[t.evento] ?? ESTILO.falha;
  const detalhe = t.detalhe ? JSON.stringify(t.detalhe, null, 2) : null;
  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-1">
        <Icone className={cn("h-4 w-4", classe)} />
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("text-sm font-medium", classe)}>{rotulo}</span>
        {t.etapa && (
          <span className="text-xs text-muted-foreground">
            em {ETAPAS[t.etapa] ?? t.etapa}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          · {format(new Date(t.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
      </div>
      {t.mensagem && (
        <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2 text-xs">
          {t.mensagem}
        </p>
      )}
      {detalhe && detalhe !== "null" && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">
            Detalhes técnicos
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-[11px]">
            {detalhe}
          </pre>
        </details>
      )}
    </li>
  );
}

/** Diálogo com a linha do tempo de tentativas (falhas, reenvios, publicações). */
export function HistoricoTentativas({ postId, titulo, trigger }: HistoricoTentativasProps) {
  const [aberto, setAberto] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["post-tentativas", postId],
    queryFn: () => listarTentativas(postId),
    enabled: aberto,
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? (
          <Button size="sm" variant="ghost">
            <History className="mr-2 h-3 w-3" />
            Ver tentativas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de tentativas</DialogTitle>
          <DialogDescription className="truncate">
            {titulo || "Post sem título"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Não foi possível carregar"}
          </p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma tentativa registrada ainda para este post.
          </p>
        ) : (
          <ul className="space-y-4">
            {data.map((t) => (
              <Linha key={t.id} t={t} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Selo compacto com o total de tentativas e a data da última falha.
 * Usa uma única consulta agregada compartilhada entre todos os cards.
 */
export function SeloTentativas({ postId, className }: { postId: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ["tentativas-resumo"],
    queryFn: resumoTentativasPorPost,
    staleTime: 30_000,
  });

  const resumo = data?.[postId];
  if (!resumo || resumo.total === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
        <RotateCcw className="h-2.5 w-2.5" />
        {resumo.total}ª tentativa
      </span>
      {resumo.ultimaFalha && (
        <span className="text-[10px] text-muted-foreground">
          última falha em{" "}
          {format(new Date(resumo.ultimaFalha), "dd/MM 'às' HH:mm", { locale: ptBR })}
        </span>
      )}
    </div>
  );
}

/** Resumo compacto do último erro, com atalho para a linha do tempo completa. */
export function ResumoUltimoErro({
  postId,
  titulo,
  erro,
  className,
}: {
  postId: string;
  titulo?: string | null;
  erro: string | null;
  className?: string;
}) {
  if (!erro) return null;
  return (
    <div
      className={cn("mt-1 rounded-md bg-destructive/10 p-2", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <SeloTentativas postId={postId} className="mb-1" />
      <p className="line-clamp-2 text-[11px] font-medium text-destructive">{erro}</p>
      <HistoricoTentativas
        postId={postId}
        titulo={titulo}
        trigger={
          <button
            type="button"
            className="mt-1 text-[11px] font-medium text-foreground underline underline-offset-2"
          >
            Ver detalhe completo
          </button>
        }
      />
    </div>
  );
}

