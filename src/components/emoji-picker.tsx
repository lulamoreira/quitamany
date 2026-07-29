import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

/**
 * Lista única de emojis usada em todo o app (legenda de post e resposta de
 * conversa). Manter num lugar só evita divergência entre as telas.
 */
export const EMOJIS = [
  "🔥","✨","🎉","💛","📦","🚚","✅","🛒","😍","🙌","👏","💡",
  "🎁","💸","⭐","👉","📸","🧡","💚","😉","🤩","🕒","📍","❤️",
] as const;

export interface EmojiPickerProps {
  /** Chamado com o emoji escolhido. Quem chama decide onde inserir. */
  onSelect: (emoji: string) => void;
  /** Gatilho customizado. Sem isso, usa o botão padrão "Emoji". */
  children?: ReactNode;
}

/**
 * Popover com uma grade de emojis comuns. O componente não conhece o campo de
 * texto de destino: apenas devolve o emoji escolhido por `onSelect`.
 */
export function EmojiPicker({ onSelect, children }: EmojiPickerProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button type="button" variant="outline" size="sm">
            <Smile className="mr-1.5 h-4 w-4" />
            Emoji
          </Button>
        )}
      </PopoverTrigger>
      {/* 248px cabe folgado em telas de 375px; collisionPadding evita estouro. */}
      <PopoverContent align="start" collisionPadding={8} className="w-[248px] max-w-[calc(100vw-1rem)] p-2">
        <div className="grid grid-cols-6 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Inserir ${emoji}`}
              className="rounded-md p-1.5 text-lg transition-colors hover:bg-accent"
              onClick={() => {
                setAberto(false);
                onSelect(emoji);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
