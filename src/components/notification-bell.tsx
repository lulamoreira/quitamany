import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, MessageCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelative } from "@/lib/format-date";
import { useNotificacoes } from "@/hooks/use-notificacoes";
import { cn } from "@/lib/utils";

/**
 * Sino de notificações global: mostra a quantidade de mensagens não lidas
 * e permite abrir a conversa correspondente com um clique.
 */
export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { conversas, total, isLoading } = useNotificacoes();
  const badge = total > 99 ? "99+" : String(total);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={total > 0 ? `${total} mensagens não lidas` : "Notificações"}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground shadow ring-2 ring-background">
              {badge}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notificações</p>
          {total > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {badge} nova{total > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Carregando…</p>}

          {!isLoading && conversas.length === 0 && (
            <div className="px-3 py-8 text-center">
              <MessageCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Nenhuma mensagem nova.</p>
            </div>
          )}

          {conversas.map((c) => {
            const nome = c.contatos?.nome || c.contatos?.username || "Contato";
            const inicial = (nome[0] ?? "?").toUpperCase();
            return (
              <Link
                key={c.id}
                to="/conversa/$id"
                params={{ id: c.id }}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {c.contatos?.foto_url && <AvatarImage src={c.contatos.foto_url} alt={nome} />}
                  <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-foreground">
                    {inicial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-semibold">{nome}</p>
                    <span className="ml-auto shrink-0 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      {c.nao_lidas}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c.ultima_mensagem?.trim() || "Nova mensagem"}
                  </p>
                  {c.ultima_msg_em && (
                    <p className="text-[10px] text-muted-foreground/70">{formatRelative(c.ultima_msg_em)}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          to="/conversas"
          onClick={() => setOpen(false)}
          className="block border-t px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-muted"
        >
          Ver todas as conversas
        </Link>
      </PopoverContent>
    </Popover>
  );
}
