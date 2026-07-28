import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, MessageSquareReply, Inbox, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FooterLinks } from "@/components/footer-links";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuitaMany — Automação de atendimento no Instagram" },
      {
        name: "description",
        content:
          "Automação de atendimento para Instagram: responda mensagens diretas e comentários automaticamente, agende publicações e centralize tudo em uma caixa de entrada.",
      },
      {
        property: "og:title",
        content: "QuitaMany — Automação de atendimento no Instagram",
      },
      {
        property: "og:description",
        content:
          "Responda DMs e comentários automaticamente, agende publicações e centralize tudo em uma caixa de entrada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session));
  }, []);

  const ctaTo = logado ? "/painel" : "/auth";
  const ctaLabel = logado ? "Abrir painel" : "Entrar";

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-10">
        <article className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-card p-8 shadow-sm">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              QuitaMany
            </h1>
            <p className="text-base leading-relaxed text-foreground">
              Automação de atendimento para Instagram: responda mensagens diretas e
              comentários automaticamente, agende publicações e centralize tudo em
              uma caixa de entrada.
            </p>
            <div className="pt-2">
              <Button asChild size="lg">
                <Link to={ctaTo}>{ctaLabel}</Link>
              </Button>
            </div>
          </header>

          <section className="space-y-3 pt-2">
            <h2 className="text-lg font-semibold text-foreground">O que faz</h2>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li className="flex gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <strong>Respostas automáticas em DM:</strong> quando alguém envia
                  uma palavra-chave no Direct, o app responde na hora.
                </div>
              </li>
              <li className="flex gap-3">
                <MessageSquareReply className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <strong>Comentário vira conversa:</strong> quem comenta uma
                  palavra-chave em uma publicação recebe resposta pública e uma
                  mensagem privada.
                </div>
              </li>
              <li className="flex gap-3">
                <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <strong>Caixa de entrada e agenda:</strong> todas as conversas em
                  um lugar, com opção de assumir o atendimento manualmente, mais
                  agendamento de publicações.
                </div>
              </li>
            </ul>
          </section>

          <section className="space-y-3 pt-2">
            <h2 className="text-lg font-semibold text-foreground">Como funciona</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              <li>
                Você conecta a sua conta profissional do Instagram, autorizando o
                acesso pelo Login do Facebook.
              </li>
              <li>
                Você define as automações e as palavras-chave que disparam cada
                resposta.
              </li>
              <li>
                O app responde por você e mostra tudo na caixa de entrada, onde
                você pode assumir a conversa a qualquer momento.
              </li>
            </ol>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-muted/40 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Privacidade e controle
              </h2>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              <li>
                O QuitaMany só acessa contas que o próprio titular conecta e
                autoriza.
              </li>
              <li>
                Quem recebe mensagens pode encerrar o contato a qualquer momento
                respondendo <strong>PARAR</strong>, e retomar respondendo{" "}
                <strong>VOLTAR</strong>.
              </li>
              <li>
                Os dados podem ser excluídos a pedido, conforme a{" "}
                <Link to="/privacidade" className="text-primary hover:underline">
                  Política de Privacidade
                </Link>
                .
              </li>
            </ul>
          </section>

          <div className="pt-2">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to={ctaTo}>{ctaLabel}</Link>
            </Button>
          </div>
        </article>
      </div>
      <FooterLinks />
    </div>
  );
}
