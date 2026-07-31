import { Film, Image as ImageIcon, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizarTipoMidia, ROTULO_TIPO_MIDIA, type TipoMidia } from "@/lib/midia-post";

export interface TipoMidiaBadgeProps extends React.ComponentProps<"span"> {
  tipo: unknown;
}

const ICONE: Record<TipoMidia, typeof Film> = {
  reels: Film,
  imagem: ImageIcon,
  carrossel: Images,
};

/** Selo pequeno que indica o formato do post (Reels / Foto / Carrossel). */
export function TipoMidiaBadge({ tipo, className, ...props }: TipoMidiaBadgeProps) {
  const normalizado = normalizarTipoMidia(tipo);
  const Icone = ICONE[normalizado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      <Icone className="h-2.5 w-2.5" aria-hidden />
      {ROTULO_TIPO_MIDIA[normalizado]}
    </span>
  );
}
