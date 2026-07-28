import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço · QuitaMany" },
      {
        name: "description",
        content:
          "Termos de Serviço do QuitaMany: uso da automação de atendimento no Instagram, responsabilidades e opt-out.",
      },
      { property: "og:title", content: "Termos de Serviço · QuitaMany" },
      {
        property: "og:description",
        content:
          "Condições de uso do QuitaMany, ferramenta de automação de mensagens diretas, comentários e agendamento no Instagram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-card p-8 shadow-sm">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Termos de Serviço
          </h1>
          <p className="text-sm text-muted-foreground">
            QuitaMany · Última atualização: 28/07/2026
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <h2 className="pt-2 text-lg font-semibold">1. Aceitação dos termos</h2>
          <p>
            Ao criar uma conta no QuitaMany, conectar sua conta profissional do
            Instagram ou utilizar qualquer funcionalidade do aplicativo, você
            declara ter lido, compreendido e concordado integralmente com estes
            Termos de Serviço. Se você não concorda com qualquer disposição
            destes termos, não deve usar o serviço.
          </p>

          <h2 className="pt-2 text-lg font-semibold">2. Descrição do serviço</h2>
          <p>
            O QuitaMany é uma ferramenta de automação de atendimento no
            Instagram, que oferece respostas automáticas a mensagens diretas e
            comentários, agendamento de publicações e uma caixa de entrada
            unificada. O serviço é operado mediante conexão autorizada da conta
            profissional do Instagram do próprio usuário, por meio da API
            oficial da Meta.
          </p>

          <h2 className="pt-2 text-lg font-semibold">
            3. Conta e responsabilidades do usuário
          </h2>
          <p>
            O usuário é integralmente responsável pelo conteúdo que envia,
            publica ou automatiza por meio do QuitaMany, bem como pelo
            cumprimento das políticas da Meta, das diretrizes da Comunidade do
            Instagram e da legislação aplicável. Cabe ao usuário manter suas
            credenciais em segurança e garantir que possui autorização para
            operar a página conectada.
          </p>

          <h2 className="pt-2 text-lg font-semibold">4. Uso aceitável</h2>
          <p>É proibido utilizar o QuitaMany para:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Envio de spam ou mensagens não solicitadas em massa.</li>
            <li>Distribuição de conteúdo ilegal, ofensivo, discriminatório ou enganoso.</li>
            <li>
              Práticas que violem as políticas da Meta, do Instagram ou
              qualquer legislação vigente.
            </li>
            <li>
              Automatizar interações que caracterizem assédio, fraude ou
              engenharia social.
            </li>
          </ul>
          <p>
            O descumprimento dessas regras pode resultar na suspensão imediata
            da conta, sem prejuízo de outras medidas cabíveis.
          </p>

          <h2 className="pt-2 text-lg font-semibold">
            5. Direito de recusa de mensagens (opt-out)
          </h2>
          <p>
            Qualquer destinatário de mensagens automáticas enviadas pelo
            QuitaMany pode encerrar o recebimento a qualquer momento respondendo
            com a palavra <strong>PARAR</strong>. Para retomar o recebimento das
            mensagens automáticas, basta responder com a palavra{" "}
            <strong>VOLTAR</strong>. O usuário do QuitaMany se compromete a
            respeitar essa manifestação e a não burlar o mecanismo de opt-out.
          </p>

          <h2 className="pt-2 text-lg font-semibold">6. Dados e privacidade</h2>
          <p>
            O tratamento de dados pessoais realizado pelo QuitaMany está
            descrito na{" "}
            <Link to="/privacidade" className="text-primary underline">
              Política de Privacidade
            </Link>
            . Para solicitar a remoção completa dos seus dados, consulte a
            página{" "}
            <Link to="/exclusao-de-dados" className="text-primary underline">
              Exclusão de Dados
            </Link>
            .
          </p>

          <h2 className="pt-2 text-lg font-semibold">
            7. Limitação de responsabilidade
          </h2>
          <p>
            O QuitaMany é fornecido "no estado em que se encontra". Não
            garantimos que o serviço estará livre de interrupções, erros ou
            indisponibilidades causadas pela Meta, pelo Instagram ou por
            terceiros. Na máxima extensão permitida pela lei, o QuitaMany não
            se responsabiliza por danos indiretos, lucros cessantes, perda de
            dados, bloqueios de conta feitos pela Meta ou consequências do uso
            indevido da ferramenta pelo usuário.
          </p>

          <h2 className="pt-2 text-lg font-semibold">8. Alterações nos termos</h2>
          <p>
            Podemos atualizar estes Termos de Serviço periodicamente para
            refletir mudanças no serviço, na legislação ou em nossas práticas.
            A versão vigente estará sempre disponível nesta página, com a data
            da última atualização indicada no topo. O uso contínuo do QuitaMany
            após uma alteração significa a aceitação dos novos termos.
          </p>

          <h2 className="pt-2 text-lg font-semibold">9. Contato</h2>
          <p>
            Dúvidas, solicitações ou reclamações sobre estes termos podem ser
            enviadas para{" "}
            <a
              href="mailto:lula1973@gmail.com"
              className="text-primary underline"
            >
              lula1973@gmail.com
            </a>
            .
          </p>
        </section>

        <footer className="border-t pt-4 text-sm">
          <Link to="/" className="text-primary hover:underline">
            ← Voltar
          </Link>
        </footer>
      </article>
    </div>
  );
}
