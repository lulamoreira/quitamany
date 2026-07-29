import { useState } from "react";
import { Heart, MessageCircle, MoreHorizontal, Send, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PostPreviewProps extends React.ComponentProps<"div"> {
  videoUrl?: string;
  legenda?: string;
  hashtags?: string;
  contaUsername?: string;
}

const LIMITE_LEGENDA = 125;

/**
 * Preview puramente visual de como o post ficará no Instagram.
 * Nenhuma interação aqui altera dados.
 */
export function PostPreview({
  videoUrl,
  legenda = "",
  hashtags = "",
  contaUsername,
  className,
  ...props
}: PostPreviewProps) {
  const [expandido, setExpandido] = useState(false);

  const arroba = contaUsername ? `@${contaUsername}` : "@sua_conta";
  const inicial = (contaUsername?.trim()?.[0] ?? "Q").toUpperCase();

  const texto = legenda.trim();
  const tags = hashtags.trim();
  const precisaTruncar = !expandido && texto.length > LIMITE_LEGENDA;
  const textoVisivel = precisaTruncar ? texto.slice(0, LIMITE_LEGENDA) : texto;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      {/* Topo */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {inicial}
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{arroba}</span>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      {/* Corpo 9:16 */}
      <div className="relative w-full bg-muted" style={{ aspectRatio: "9 / 16" }}>
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            muted
            playsInline
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Video className="h-8 w-8" aria-hidden />
            <span className="text-xs">Seu vídeo aparece aqui</span>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="space-y-2 px-3 py-3">
        <div className="flex items-center gap-4 text-foreground" aria-hidden>
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
        </div>

        <p className="break-words text-sm leading-relaxed">
          <span className="font-semibold">{arroba}</span>{" "}
          {textoVisivel ? (
            <span className="whitespace-pre-wrap text-foreground">{textoVisivel}</span>
          ) : (
            <span className="text-muted-foreground">Sua legenda aparece aqui…</span>
          )}
          {precisaTruncar && (
            <>
              <span className="text-muted-foreground">… </span>
              <button
                type="button"
                onClick={() => setExpandido(true)}
                className="text-muted-foreground hover:underline"
              >
                mais
              </button>
            </>
          )}
          {tags && (!precisaTruncar || expandido) && (
            <>
              {" "}
              <span className="break-words font-medium text-foreground">{tags}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
