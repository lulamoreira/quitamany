import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, MessageCircle, LogOut, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuitaMany · Estúdio Instagram" },
      { name: "description", content: "Publicador e automação de conversas do Instagram, num só lugar." },
      { property: "og:title", content: "QuitaMany · Estúdio Instagram" },
      { property: "og:description", content: "Publicador e automação de conversas do Instagram, num só lugar." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const { data: role } = useMyRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
      } else {
        setAuthed(true);
      }
      setChecking(false);
    });
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (checking || !authed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role === "pendente") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Aguardando aprovação</h1>
            <p className="mt-2 text-muted-foreground">
              Um administrador precisa liberar seu acesso.
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Estúdio Instagram
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Escolha um módulo</h1>
          <p className="text-muted-foreground">Publique conteúdo ou converse com sua audiência.</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/publicador">
            <Card className="group h-full cursor-pointer border-transparent p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[var(--shadow-soft)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarDays className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Publicador</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Agende e publique Reels automaticamente no Instagram.
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-primary group-hover:underline">
                Abrir →
              </span>
            </Card>
          </Link>

          <Link to="/quitamany">
            <Card className="group h-full cursor-pointer border-transparent p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[var(--shadow-soft)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">QuitaMany</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Automatize comentários e Direct com bots e inbox ao vivo.
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-primary group-hover:underline">
                Abrir →
              </span>
            </Card>
          </Link>
        </div>

        <div className="pt-4 text-center">
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
