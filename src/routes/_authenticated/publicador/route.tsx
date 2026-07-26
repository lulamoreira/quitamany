import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, Clock, PlusCircle, Settings, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DesktopShell } from "@/components/desktop-shell";

export const Route = createFileRoute("/_authenticated/publicador")({
  component: PublicadorLayout,
});

function PublicadorLayout() {
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

  if (role === "pendente") return <PendingApproval />;

  const path = location.pathname;
  const tabs = [
    { to: "/publicador", label: "Agenda", icon: CalendarDays, exact: true },
    { to: "/publicador/novo", label: "Novo", icon: PlusCircle },
    { to: "/publicador/historico", label: "Histórico", icon: Clock },
    { to: "/publicador/ajustes", label: "Ajustes", icon: Settings },
  ] as const;

  return (
    <>
      {/* Desktop: sidebar shell */}
      <div className="hidden lg:block">
        <DesktopShell>
          <Outlet />
        </DesktopShell>
      </div>

      {/* Mobile: bottom nav (inalterado) */}
      <div className="lg:hidden min-h-screen bg-background pb-20">
        <main className="mx-auto max-w-2xl px-4 pt-6">
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
                    "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
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

function PendingApproval() {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Aguardando aprovação</h1>
          <p className="mt-2 text-muted-foreground">
            Sua conta foi criada! Um administrador precisa liberar seu acesso antes de você
            começar a agendar posts.
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
