import { Heart, MessageCircle, Share2, Repeat2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/** Formato mínimo esperado do post para exibir desempenho. */
export interface MetricasPostProps extends React.ComponentProps<"div"> {
  curtidas?: number | null;
  comentarios?: number | null;
  compartilhamentos?: number | null;
  reposts?: number | null;
  metricasEm?: string | null;
}

/** Compacta números grandes: 1.2 mil em vez de 1234. */
function formatarNumero(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(".", ",")} mil`;
}

interface ItemProps {
  icone: React.ElementType;
  rotulo: string;
  valor: number | null | undefined;
}

function Item({ icone: Icone, rotulo, valor }: ItemProps) {
  // Métrica indisponível na Meta (tipo de mídia sem insights) → mostramos "–"
  // em vez de zero, para não induzir a leitura errada.
  const indisponivel = valor === null || valor === undefined;
  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      title={indisponivel ? `${rotulo}: não disponível para esta mídia` : rotulo}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className={cn("tabular-nums", !indisponivel && "font-medium text-foreground")}>
        {indisponivel ? "–" : formatarNumero(valor)}
      </span>
      <span className="sr-only">{rotulo}</span>
    </div>
  );
}

/**
 * Painel de desempenho da publicação (curtidas, comentários, compartilhamentos
 * e reposts). Não renderiza nada enquanto nenhuma coleta tiver acontecido.
 */
export function MetricasPost({
  curtidas,
  comentarios,
  compartilhamentos,
  reposts,
  metricasEm,
  className,
  ...props
}: MetricasPostProps) {
  const nuncaColetado =
    !metricasEm &&
    [curtidas, comentarios, compartilhamentos, reposts].every((v) => v === null || v === undefined);
  if (nuncaColetado) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/60 px-3 py-2",
        className,
      )}
      {...props}
    >
      <Item icone={Heart} rotulo="Curtidas" valor={curtidas} />
      <Item icone={MessageCircle} rotulo="Comentários" valor={comentarios} />
      <Item icone={Share2} rotulo="Compartilhamentos" valor={compartilhamentos} />
      <Item icone={Repeat2} rotulo="Reposts" valor={reposts} />
      {metricasEm && (
        <span className="ml-auto text-[11px] text-muted-foreground/80">
          Atualizado em {format(new Date(metricasEm), "dd/MM 'às' HH:mm", { locale: ptBR })}
        </span>
      )}
    </div>
  );
}
