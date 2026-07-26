import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MessageCircle, Zap, Users, Settings, Loader2, LogOut, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DesktopShell } from "@/components/desktop-shell";

export const Route = createFileRoute("/_authenticated/quitamany")({
  component: QuitaManyLayout,
});

function QuitaManyLayout() {
  const { data: role, isLoading } = useMyRole();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role === "pendente") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Aguardando aprovação</h1>
          <p className="text-muted-foreground">Um administrador precisa liberar seu acesso.</p>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  const path = location.pathname;
  const tabs: Array<{ to: string; label: string; icon: typeof MessageCircle; exact?: boolean }> = [
    { to: "/quitamany", label: "Conversas", icon: MessageCircle, exact: true },
    { to: "/quitamany/automacoes", label: "Automações", icon: Zap },
    { to: "/quitamany/contatos", label: "Contatos", icon: Users },
    { to: "/quitamany/ajustes", label: "Ajustes", icon: Settings },
  ];

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        <DesktopShell>
          <Outlet />
        </DesktopShell>
      </div>

      {/* Mobile */}
      <div className="lg:hidden min-h-screen bg-background pb-24">
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <Link to="/" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Módulos
          </Link>
        </div>
        <main className="mx-auto max-w-2xl px-4 pt-4">
          <Outlet />
        </main>
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-stretch justify-around">
            {tabs.map((t) => {
              const active = t.exact ? path === t.to : path.startsWith(t.to);
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "fill-primary/15")} strokeWidth={active ? 2.5 : 2} />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
