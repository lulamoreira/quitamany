import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  PlusCircle,
  Clock,
  Settings,
  MessageCircle,
  Zap,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Home,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { useContaInstagram } from "@/hooks/use-conta-instagram";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FooterLinks } from "@/components/footer-links";


type Item = { to: string; label: string; icon: typeof CalendarDays; exact?: boolean };

const SECTIONS: Array<{ title: string | null; items: Item[] }> = [
  {
    title: null,
    items: [{ to: "/painel", label: "Início", icon: Home, exact: true }],
  },
  {
    title: "Publicações",
    items: [
      { to: "/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/novo", label: "Novo post", icon: PlusCircle },
      { to: "/historico", label: "Histórico", icon: Clock },
    ],
  },
  {
    title: "Conversas",
    items: [
      { to: "/conversas", label: "Conversas", icon: MessageCircle },
      { to: "/automacoes", label: "Automações", icon: Zap },
      { to: "/contatos", label: "Contatos", icon: Users },
    ],
  },
];

const BOTTOM_ITEMS: Item[] = [{ to: "/ajustes", label: "Ajustes", icon: Settings }];

/**
 * Layout desktop: sidebar fixa 240px (recolhível para 64px) + área de conteúdo.
 * Persistência do estado colapsado em localStorage. Atalho [ para toggle.
 */
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("desktop-sidebar-collapsed") === "1";
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { data: role } = useMyRole();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then((res) => setEmail(res.data.user?.email ?? ""));
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("desktop-sidebar-collapsed", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "[") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (item: Item) => {
    if (item.exact) return location.pathname === item.to;
    // Match exact or subpath; special-case conversa/$id -> conversas
    if (item.to === "/conversas" && location.pathname.startsWith("/conversa/")) return true;
    return location.pathname === item.to || location.pathname.startsWith(item.to + "/");
  };

  const sair = async () => {
    await supabase.auth.signOut();
    toast.success("Até logo!");
    navigate({ to: "/auth", replace: true });
  };

  const inicial = (email[0] ?? "?").toUpperCase();
  const { username: contaUsername, conectado: contaConectada } = useContaInstagram();
  // Telas de conversa usam layout de 3 colunas em altura cheia (sem respiro extra).
  const chatLayout = location.pathname.startsWith("/conversa");

  return (
    <div className={cn("flex bg-background", chatLayout ? "h-screen overflow-hidden" : "min-h-screen")}>
      <aside
        className={cn(
          "sticky top-0 z-30 flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-2 border-b border-border/60 px-3",
            collapsed && "justify-center px-0",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">QuitaMany</p>
              <p className={cn("truncate text-[10px]", contaConectada ? "text-muted-foreground" : "text-muted-foreground/70 italic")}>
                {contaConectada ? `@${contaUsername}` : "conta não conectada"}
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
          {SECTIONS.map((sec, idx) => (
            <div key={sec.title ?? `sec-${idx}`}>
              {!collapsed && sec.title && (
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {sec.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {sec.items.map((it) => {
                  const active = isActive(it);
                  const Icon = it.icon;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        title={collapsed ? it.label : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                            : "font-medium text-foreground/70 hover:bg-muted hover:text-foreground",
                          collapsed && "justify-center px-0",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-current")} />
                        {!collapsed && <span className="truncate">{it.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border/60 p-2">
          <ul className="mb-2 space-y-0.5">
            {BOTTOM_ITEMS.map((it) => {
              const active = isActive(it);
              const Icon = it.icon;
              return (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    title={collapsed ? it.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                        : "font-medium text-foreground/70 hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div
            className={cn(
              "flex items-center gap-2 rounded-xl bg-muted p-2",
              collapsed && "justify-center bg-transparent p-0",
            )}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 font-bold text-foreground">{inicial}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{email || "—"}</p>
                <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  {role || "…"}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={sair}
                title="Sair"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setCollapsed((c) => !c)}
            title="Recolher sidebar ( [ )"
            className={cn(
              "mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <>
                <ChevronLeft className="h-3.5 w-3.5" /> Recolher
              </>
            )}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          // --shell-pad: respiro lateral/vertical padrão do conteúdo autenticado.
          // Telas de conversa (3 colunas) usam 0 para não perder área útil e
          // precisam de min-h-0 para que a altura seja o espaço restante real.
          chatLayout
            ? "min-h-0 [--shell-pad:0px]"
            : "[--shell-pad:1.5rem] lg:[--shell-pad:2.5rem]",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col px-[var(--shell-pad)] py-[var(--shell-pad)]",
            chatLayout && "min-h-0",
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full min-w-0 flex-1 flex-col",
              chatLayout ? "min-h-0 max-w-none" : "max-w-[1280px] gap-6",
            )}
          >
            {children}
          </div>
        </div>
        {!chatLayout && <FooterLinks />}
      </div>


    </div>
  );
}

export function DesktopPageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
}: {
  breadcrumb?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 -mx-[var(--shell-pad)] -mt-[var(--shell-pad)] mb-2 border-b border-border/60 bg-background/95 px-[max(var(--shell-pad),1.5rem)] py-4 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
        <div className="min-w-0">
          {breadcrumb && (
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">{breadcrumb}</div>
          )}
          <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
