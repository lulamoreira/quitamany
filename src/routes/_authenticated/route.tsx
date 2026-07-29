import { createFileRoute, Outlet, redirect, useLocation, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  MessageCircle,
  Zap,
  CalendarDays,
  Plus,
  Menu,
  Users as UsersIcon,
  Clock,
  Settings,
  LogOut,
  Home as HomeIcon,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { DesktopShell } from "@/components/desktop-shell";
import { FooterLinks } from "@/components/footer-links";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: role, isLoading } = useMyRole();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Telas de conversa gerenciam a própria altura (composer fixo) — sem rodapé/padding extra.
  const chatLayout = pathname.startsWith("/conversa/");

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

  return (
    <>
      {/* Desktop shell */}
      <div className="hidden lg:block">
        <DesktopShell>
          <Outlet />
        </DesktopShell>
      </div>

      {/* Mobile: bottom nav 5 itens */}
      <div
        className={cn(
          "lg:hidden bg-background",
          chatLayout
            ? "h-[100dvh] overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
            : "min-h-screen pb-[calc(8.5rem+env(safe-area-inset-bottom))]",
        )}
      >
        <main
          className={cn(
            "mx-auto flex w-full max-w-2xl min-w-0 flex-col",
            chatLayout ? "h-full min-h-0" : "gap-6 px-4 pb-6 pt-6 sm:px-6",
          )}
        >
          <Outlet />
        </main>
        {!chatLayout && (
          <div className="pointer-events-auto fixed right-3 top-3 z-50 rounded-full bg-card/95 shadow-md backdrop-blur">
            <NotificationBell />
          </div>
        )}
        {!chatLayout && <FooterLinks />}
        <MobileBottomNav />
      </div>


    </>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const [maisOpen, setMaisOpen] = useState(false);

  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path.startsWith(to));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-5 items-end">
        <NavItem to="/conversas" icon={MessageCircle} label="Conversas" active={isActive("/conversas") || path.startsWith("/conversa/")} />
        <NavItem to="/automacoes" icon={Zap} label="Automações" active={isActive("/automacoes")} />
        <NovoCentro />
        <NavItem to="/agenda" icon={CalendarDays} label="Agenda" active={isActive("/agenda", true) || path === "/"} />
        <MaisButton open={maisOpen} onOpenChange={setMaisOpen} />
      </div>
    </nav>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: typeof MessageCircle;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-1 py-2 text-[10px] transition-colors",
        active ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active && "bg-primary text-primary-foreground",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
      </span>
      <span>{label}</span>
    </Link>
  );
}

function NovoCentro() {
  return (
    <Link
      to="/novo"
      className="relative -mt-6 flex flex-col items-center gap-1"
      aria-label="Novo post"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95">
        <Plus className="h-6 w-6" strokeWidth={2.75} />
      </span>
      <span className="pb-1 text-[10px] font-medium text-muted-foreground">Novo</span>
    </Link>
  );
}

function MaisButton({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: role } = useMyRole();
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then((r) => setEmail(r.data.user?.email ?? ""));
  }, []);

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const items: Array<{ to: string; icon: typeof UsersIcon; label: string }> = [
    { to: "/contatos", icon: UsersIcon, label: "Contatos" },
    { to: "/historico", icon: Clock, label: "Histórico" },
    { to: "/ajustes", icon: Settings, label: "Ajustes" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button className="flex flex-col items-center gap-1 py-3 text-[10px] font-medium text-muted-foreground hover:text-foreground">
          <Menu className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Mais</SheetTitle>
        </SheetHeader>
        <div className="space-y-1 py-2">
          <Link
            to="/painel"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
          >
            <HomeIcon className="h-5 w-5 text-muted-foreground" />
            <span>Início</span>
          </Link>
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
            >
              <it.icon className="h-5 w-5 text-muted-foreground" />
              <span>{it.label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 rounded-2xl border p-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 font-bold text-foreground">
              {(email[0] ?? "?").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{email || "—"}</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {role || "…"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={sair} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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
            Sua conta foi criada! Um administrador precisa liberar seu acesso.
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}
