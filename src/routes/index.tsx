import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  MessageCircle,
  MessageSquareReply,
  Inbox,
  ArrowRight,
  Heart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FooterLinks } from "@/components/footer-links";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  IlustraConectar,
  IlustraPalavraChave,
  IlustraCaixaEntrada,
  IlustraPrivacidade,
} from "@/components/landing/ilustracoes";
import heroBg from "@/assets/hero-bg.png.asset.json";

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

// Paleta local — não mexe no tema global
const C = {
  tinta: "#0B0B0F",
  amarelo: "#FFE24B",
  coral: "#FF5A5F",
  creme: "#FAF9F6",
  branco: "#FFFFFF",
};

const displayStyle: React.CSSProperties = {
  fontWeight: 900,
  letterSpacing: "-0.03em",
  lineHeight: 0.95,
};

function LandingPage() {
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session));
  }, []);

  const ctaTo = logado ? "/painel" : "/auth";
  const ctaLabel = logado ? "Abrir painel" : "Entrar";

  return (
    <div style={{ background: C.creme, color: C.tinta }} className="min-h-screen">
      {/* HEADER */}
      <header
        style={{ background: C.tinta, color: C.branco }}
        className="sticky top-0 z-30 border-b border-white/5"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/" className="text-lg font-black tracking-tight">
            QuitaMany
          </Link>
          <Link
            to={ctaTo}
            style={{ background: C.amarelo, color: C.tinta }}
            className="rounded-full px-5 py-2 text-sm font-semibold transition hover:opacity-90"
          >
            {ctaLabel}
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section
        className="relative flex h-screen min-h-[640px] w-full items-center justify-center overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `url(${heroBg.url})`,
          color: C.branco,
        }}
      >
        {/* Overlay escuro com blur */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 py-16 text-center">
          <h1
            style={{ ...displayStyle, fontSize: "clamp(2.5rem, 7vw, 5.5rem)" }}
            className="text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]"
          >
            Seu Instagram respondendo sozinho.
          </h1>
          <p
            className="mt-6 max-w-2xl text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)]"
            style={{ fontSize: "1.15rem", lineHeight: 1.6 }}
          >
            Automação de atendimento para Instagram: responda mensagens
            diretas e comentários automaticamente, agende publicações e
            centralize tudo em uma caixa de entrada.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to={ctaTo}
              style={{ background: C.amarelo, color: C.tinta }}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-lg transition hover:opacity-90"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Como funciona
            </a>
          </div>
        </div>
      </section>

      {/* FAIXA AMARELA */}
      <section style={{ background: C.amarelo, color: C.tinta }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <h2
              style={{ ...displayStyle, fontSize: "clamp(2.25rem, 6vw, 4.5rem)" }}
            >
              Comentário vira conversa.
            </h2>
            <p
              className="mt-5 max-w-md"
              style={{ fontSize: "1.1rem", lineHeight: 1.6 }}
            >
              Quando alguém comenta uma palavra-chave em uma publicação, o
              QuitaMany responde ali no comentário e ainda manda uma mensagem
              privada para continuar o atendimento.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <CommentToDMMockup />
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section
        id="como-funciona"
        style={{ background: C.creme, color: C.tinta }}
      >
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <h2
            style={{ ...displayStyle, fontSize: "clamp(2rem, 5vw, 3.75rem)" }}
            className="max-w-2xl"
          >
            Como funciona.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <StepCard
              n="01"
              bg={C.branco}
              title="Conecte sua conta"
              text="Autorize sua conta profissional do Instagram pelo Login do Facebook."
              ilustracao={<IlustraConectar className="h-24 w-24 md:h-28 md:w-28" />}
            />
            <StepCard
              n="02"
              bg={C.amarelo}
              title="Defina as regras"
              text="Escolha palavras-chave e as respostas automáticas para DMs e comentários."
              ilustracao={<IlustraPalavraChave className="h-24 w-24 md:h-28 md:w-28" />}
            />
            <StepCard
              n="03"
              bg="#FFD9DA"
              title="Assuma quando quiser"
              text="O app responde por você. Na caixa de entrada, você entra na conversa quando precisar."
              ilustracao={<IlustraCaixaEntrada className="h-24 w-24 md:h-28 md:w-28" />}
            />
          </div>
        </div>
      </section>

      {/* O QUE FAZ */}
      <section style={{ background: C.branco, color: C.tinta }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <h2
            style={{ ...displayStyle, fontSize: "clamp(2rem, 5vw, 3.75rem)" }}
            className="max-w-2xl"
          >
            O que faz.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <Feature
              icon={<MessageCircle className="h-6 w-6" />}
              title="Respostas automáticas em DM"
              text="Quando alguém envia uma palavra-chave no Direct, o app responde na hora."
            />
            <Feature
              icon={<MessageSquareReply className="h-6 w-6" />}
              title="Comentário vira conversa"
              text="Quem comenta uma palavra-chave em uma publicação recebe resposta pública e uma mensagem privada."
            />
            <Feature
              icon={<Inbox className="h-6 w-6" />}
              title="Caixa de entrada e agenda"
              text="Todas as conversas em um lugar, com opção de assumir o atendimento manualmente, mais agendamento de publicações."
            />
          </div>
        </div>
      </section>

      {/* PRIVACIDADE */}
      <section style={{ background: C.tinta, color: C.branco }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <Heart className="h-6 w-6" style={{ color: C.amarelo }} />
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: C.amarelo }}
                >
                  Privacidade e controle
                </span>
              </div>
              <h2
                style={{ ...displayStyle, fontSize: "clamp(2rem, 5vw, 3.75rem)" }}
                className="mt-4 text-white"
              >
                Consentimento primeiro, sempre.
              </h2>
            </div>
            <IlustraPrivacidade className="h-28 w-28 shrink-0 self-start md:self-center" />
          </div>
          <div className="mt-10 grid gap-8 text-white/80 md:grid-cols-3">
            <p style={{ fontSize: "1.05rem", lineHeight: 1.6 }}>
              O QuitaMany só acessa contas que o próprio titular conecta e
              autoriza.
            </p>
            <p style={{ fontSize: "1.05rem", lineHeight: 1.6 }}>
              Quem recebe mensagens pode encerrar o contato a qualquer momento
              respondendo{" "}
              <span
                style={{ background: C.amarelo, color: C.tinta }}
                className="rounded px-1.5 py-0.5 font-bold"
              >
                PARAR
              </span>
              , e retomar respondendo{" "}
              <span
                style={{ background: C.amarelo, color: C.tinta }}
                className="rounded px-1.5 py-0.5 font-bold"
              >
                VOLTAR
              </span>
              .
            </p>
            <p style={{ fontSize: "1.05rem", lineHeight: 1.6 }}>
              Os dados podem ser excluídos a pedido, conforme a{" "}
              <Link
                to="/privacidade"
                className="underline"
                style={{ color: C.amarelo }}
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: C.creme, color: C.tinta }}>
        <div className="mx-auto max-w-3xl px-5 py-16 md:py-24">
          <h2
            style={{ ...displayStyle, fontSize: "clamp(2rem, 5vw, 3.75rem)" }}
          >
            Perguntas frequentes.
          </h2>
          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="1">
              <AccordionTrigger className="text-base font-semibold">
                Preciso saber programar?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-black/70">
                Não. As automações são criadas por formulário, escolhendo
                palavras-chave e a resposta.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="2">
              <AccordionTrigger className="text-base font-semibold">
                Funciona com qualquer conta do Instagram?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-black/70">
                É necessária uma conta profissional (comercial ou criador)
                vinculada a uma Página do Facebook.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="3">
              <AccordionTrigger className="text-base font-semibold">
                Como alguém para de receber mensagens?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-black/70">
                Respondendo PARAR na conversa. O robô para na hora e o contato
                fica marcado.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="4">
              <AccordionTrigger className="text-base font-semibold">
                Posso responder manualmente?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-black/70">
                Sim. Na caixa de entrada há o botão Assumir, que desliga o robô
                naquela conversa.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background: C.amarelo, color: C.tinta }}>
        <div className="mx-auto max-w-6xl px-5 py-20 text-center md:py-28">
          <h2
            style={{ ...displayStyle, fontSize: "clamp(2.25rem, 6vw, 4.75rem)" }}
            className="mx-auto max-w-3xl"
          >
            Pronto para deixar o Instagram trabalhando por você?
          </h2>
          <div className="mt-8">
            <Link
              to={ctaTo}
              style={{ background: C.tinta, color: C.branco }}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold transition hover:opacity-90"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <FooterLinks />
    </div>
  );
}

/* ---------- SUBCOMPONENTES ---------- */

function StepCard({
  n,
  title,
  text,
  bg,
  ilustracao,
}: {
  n: string;
  title: string;
  text: string;
  bg: string;
  ilustracao?: React.ReactNode;
}) {
  return (
    <div
      style={{ background: bg }}
      className="rounded-3xl p-7 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
    >
      {ilustracao ? <div className="mb-4">{ilustracao}</div> : null}
      <div
        className="text-sm font-black tracking-widest"
        style={{ color: C.tinta, opacity: 0.5 }}
      >
        {n}
      </div>
      <h3
        className="mt-4 text-xl font-black tracking-tight"
        style={{ color: C.tinta }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-[15px] leading-relaxed"
        style={{ color: C.tinta, opacity: 0.75 }}
      >
        {text}
      </p>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div>
      <div
        style={{ background: C.tinta, color: C.amarelo }}
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
      >
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-black tracking-tight">{title}</h3>
      <p
        className="mt-2 text-[15px] leading-relaxed"
        style={{ opacity: 0.75 }}
      >
        {text}
      </p>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div
      className="w-[280px] shrink-0 rounded-[2.5rem] p-2 shadow-2xl"
      style={{ background: "#1a1a20" }}
    >
      <div
        className="overflow-hidden rounded-[2rem]"
        style={{ background: C.branco }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
          <div
            className="h-8 w-8 rounded-full"
            style={{
              background:
                "linear-gradient(135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)",
            }}
          />
          <div>
            <div className="text-[13px] font-bold" style={{ color: C.tinta }}>
              quitanda3d
            </div>
            <div className="text-[10px] text-black/50">Ativo agora</div>
          </div>
        </div>
        {/* Messages */}
        <div className="space-y-2 px-3 py-4" style={{ background: "#fafafa" }}>
          <div className="flex">
            <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-black/5 px-3.5 py-2 text-[13px] text-black/80">
              quanto custa
            </div>
          </div>
          <div className="flex justify-end">
            <div
              className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] text-white"
              style={{ background: "#0095F6" }}
            >
              Ótima escolha! 😄 Me manda a peça que você quer que te passo o
              valor certinho.
            </div>
          </div>
          <div className="flex justify-end">
            <div
              className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-1.5 text-[11px] italic text-white/90"
              style={{ background: "#0095F6" }}
            >
              Responda PARAR para não receber mais mensagens.
            </div>
          </div>
        </div>
        {/* Input */}
        <div className="border-t border-black/5 px-3 py-2.5">
          <div className="rounded-full bg-black/5 px-4 py-2 text-[12px] text-black/40">
            Mensagem…
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentToDMMockup() {
  return (
    <div className="w-full max-w-sm space-y-3">
      {/* Post card */}
      <div
        className="rounded-2xl bg-white p-4 shadow-sm"
        style={{ color: C.tinta }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-full"
            style={{
              background:
                "linear-gradient(135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)",
            }}
          />
          <div className="text-[12px] font-bold">quitanda3d</div>
        </div>
        <div
          className="mt-3 h-24 rounded-xl"
          style={{ background: "#f0eee9" }}
        />
        <div className="mt-3 rounded-xl bg-black/[0.04] px-3 py-2 text-[12px]">
          <span className="font-semibold">mari.souza</span>{" "}
          <span className="text-black/70">quero</span>
        </div>
      </div>
      {/* Arrow */}
      <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest text-black/60">
        <div className="h-px w-8 bg-black/30" />
        Vira DM
        <ArrowRight className="h-4 w-4" />
      </div>
      {/* DM bubble */}
      <div
        className="rounded-2xl p-4 shadow-sm"
        style={{ background: C.tinta, color: C.branco }}
      >
        <div className="text-[11px] uppercase tracking-widest text-white/40">
          Direct
        </div>
        <div className="mt-2 flex justify-end">
          <div
            className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] text-white"
            style={{ background: "#0095F6" }}
          >
            Oi! Vi seu comentário 💛 Aqui está o link com todos os detalhes.
          </div>
        </div>
      </div>
    </div>
  );
}
