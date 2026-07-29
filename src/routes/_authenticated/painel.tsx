import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  CalendarDays,
  Zap,
  PlugZap,
  ArrowRight,
  PlusCircle,
  Inbox,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, endOfWeek, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsDesktop } from "@/hooks/use-desktop";
import { DesktopPageHeader } from "@/components/desktop-shell";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Início · QuitaMany" },
      { name: "description", content: "Painel unificado de publicações e conversas do Instagram." },
      { property: "og:title", content: "QuitaMany" },
      { property: "og:description", content: "Publicações e conversas do Instagram em um só lugar." },
    ],
  }),
  component: DashboardPage,
});

function AtalhoCard({
  titulo,
  descricao,
  icon: Icon,
  onClick,
}: {
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer border-transparent p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-3 text-sm font-bold">{titulo}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
    </Card>
  );
}

function DashboardPage() {
  const isDesktop = useIsDesktop();
  const [nome, setNome] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then((r) => {
      const email = r.data.user?.email ?? "";
      setNome(email.split("@")[0] || "");
    });
  }, []);

  const { data: naoLidas = 0 } = useQuery({
    queryKey: ["dash-nao-lidas"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conversas")
        .select("nao_lidas")
        .gt("nao_lidas", 0);
      return ((data as { nao_lidas: number }[]) ?? []).reduce((acc, c) => acc + (c.nao_lidas || 0), 0);
    },
    refetchInterval: 30_000,
  });

  const { data: postsSemana = 0 } = useQuery({
    queryKey: ["dash-posts-semana"],
    queryFn: async () => {
      const ini = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const fim = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const { count } = await supabase
        .from("posts_agendados")
        .select("id", { count: "exact", head: true })
        .eq("status", "agendado")
        .gte("agendado_para", ini)
        .lte("agendado_para", fim);
      return count ?? 0;
    },
  });

  const { data: automAtivas = 0 } = useQuery({
    queryKey: ["dash-autom"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("automacoes")
        .select("id", { count: "exact", head: true })
        .eq("ativa", true);
      return count ?? 0;
    },
  });

  const { data: cfg } = useQuery({
    queryKey: ["dash-ig-config"],
    queryFn: async () => {
      const { data } = await supabase.from("ig_config").select("*").limit(1).maybeSingle();
      return data as any;
    },
  });

  const conectado = !!cfg?.conta_username;
  const saudacao = getSaudacao();

  const body = (
    <div className="space-y-6">
      {!isDesktop && (
        <header className="pt-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{saudacao}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {nome ? `Olá, ${nome}!` : "Olá!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </header>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">O que você quer fazer?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AtalhoCard
            titulo="Criar um post"
            descricao="Monte um Reel e agende a publicação"
            icon={PlusCircle}
            onClick={() => navigate({ to: "/novo" })}
          />
          <AtalhoCard
            titulo="Ver conversas"
            descricao="Responda comentários e mensagens"
            icon={Inbox}
            onClick={() => navigate({ to: "/conversas" })}
          />
          <AtalhoCard
            titulo="Montar automação"
            descricao="Responda por palavra-chave sozinho"
            icon={Zap}
            onClick={() => navigate({ to: "/automacoes" })}
          />
          <AtalhoCard
            titulo="Ver a agenda"
            descricao="Acompanhe o que já está programado"
            icon={CalendarDays}
            onClick={() => navigate({ to: "/agenda" })}
          />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCard
          titulo="Não lidas"
          valor={naoLidas}
          icon={MessageCircle}
          cor="text-blue-600 dark:text-blue-400"
          fundo="bg-blue-500/10"
          onClick={() => navigate({ to: "/conversas" })}
        />
        <ResumoCard
          titulo="Agendados esta semana"
          valor={postsSemana}
          icon={CalendarDays}
          cor="text-violet-600 dark:text-violet-400"
          fundo="bg-violet-500/10"
          onClick={() => navigate({ to: "/agenda" })}
        />
        <ResumoCard
          titulo="Automações ativas"
          valor={automAtivas}
          icon={Zap}
          cor="text-amber-600 dark:text-amber-400"
          fundo="bg-amber-500/10"
          onClick={() => navigate({ to: "/automacoes" })}
        />
        <Card
          onClick={() => navigate({ to: "/ajustes" })}
          className="group cursor-pointer border-transparent p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-start justify-between">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                conectado ? "bg-green-500/10" : "bg-red-500/10"
              }`}
            >
              <PlugZap
                className={`h-5 w-5 ${
                  conectado ? "text-green-600 dark:text-green-400" : "text-red-500"
                }`}
              />
            </div>
            {conectado ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="mt-3 text-xs font-medium text-muted-foreground">Conexão Meta</p>
          <p className="mt-0.5 truncate text-sm font-bold">
            {conectado ? `@${cfg.conta_username}` : "Desconectado"}
          </p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/novo">
          <Card className="group h-full cursor-pointer border-transparent p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PlusCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Novo post</p>
                <p className="text-xs text-muted-foreground">Agende um Reel para @quitanda3d</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        </Link>

        <Link to="/conversas">
          <Card className="group h-full cursor-pointer border-transparent p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Ver conversas</p>
                <p className="text-xs text-muted-foreground">Inbox unificado do Instagram</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <>
        <DesktopPageHeader
          title={nome ? `Olá, ${nome}!` : "Início"}
          subtitle={`${saudacao} · ${format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}`}
          actions={
            <Button onClick={() => navigate({ to: "/novo" })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Novo post
            </Button>
          }
        />
        {body}
      </>
    );
  }

  return body;
}

function ResumoCard({
  titulo,
  valor,
  icon: Icon,
  cor,
  fundo,
  onClick,
}: {
  titulo: string;
  valor: number;
  icon: typeof MessageCircle;
  cor: string;
  fundo: string;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="group cursor-pointer border-transparent p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${fundo}`}>
        <Icon className={`h-5 w-5 ${cor}`} />
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-2xl font-bold">{valor}</p>
    </Card>
  );
}

function getSaudacao() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
