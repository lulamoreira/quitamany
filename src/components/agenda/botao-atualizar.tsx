import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BotaoAtualizarProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> {
  /** Executa a sincronização. Deve resolver quando os dados chegarem. */
  onAtualizar: () => Promise<unknown>;
  /** Exibe apenas o ícone (útil em telas estreitas). */
  somenteIcone?: boolean;
}

/** Botão de sincronização manual, com estado de carregamento e feedback. */
export function BotaoAtualizar({
  onAtualizar,
  somenteIcone = false,
  className,
  variant = "outline",
  size = "sm",
  disabled,
  ...props
}: BotaoAtualizarProps) {
  const [carregando, setCarregando] = useState(false);

  async function executar() {
    if (carregando) return;
    setCarregando(true);
    try {
      await onAtualizar();
      toast.success("Lista atualizada");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Não foi possível atualizar agora.";
      toast.error(msg);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={executar}
      disabled={disabled || carregando}
      aria-label="Atualizar agora"
      title="Atualizar agora"
      className={cn("gap-2", className)}
      {...props}
    >
      <RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />
      {!somenteIcone && <span>{carregando ? "Atualizando…" : "Atualizar"}</span>}
    </Button>
  );
}
