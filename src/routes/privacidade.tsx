import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade · QuitaMany" },
      {
        name: "description",
        content:
          "Política de Privacidade do QuitaMany: quais dados tratamos, finalidade e contato do responsável.",
      },
      { property: "og:title", content: "Política de Privacidade · QuitaMany" },
      {
        property: "og:description",
        content: "Como o QuitaMany trata dados de conta Instagram, mensagens e contatos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-card p-8 shadow-sm">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Política de Privacidade
          </h1>
          <p className="text-sm text-muted-foreground">
            QuitaMany · Última atualização: 26/07/2026
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            O QuitaMany é uma ferramenta de automação de atendimento e agendamento de
            publicações no Instagram, utilizada pelo próprio negócio conectado. Esta
            política explica quais dados tratamos e para quê.
          </p>

          <h2 className="pt-2 text-lg font-semibold">1. Dados que tratamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Informações da conta Instagram conectada (nome de usuário, ID da página
              vinculada e token de acesso emitido pela Meta).
            </li>
            <li>
              Mensagens diretas e comentários recebidos por meio da API oficial da Meta
              (Instagram Graph API).
            </li>
            <li>Contatos que interagem com a conta e etiquetas atribuídas manualmente.</li>
            <li>
              Conteúdos criados pelo próprio usuário do sistema (posts agendados,
              legendas, mídias).
            </li>
          </ul>

          <h2 className="pt-2 text-lg font-semibold">2. Finalidade</h2>
          <p>
            Os dados são usados exclusivamente para automação de atendimento e
            agendamento de publicações do próprio negócio conectado. Não realizamos
            perfilamento para terceiros nem venda de dados.
          </p>

          <h2 className="pt-2 text-lg font-semibold">3. Armazenamento e segurança</h2>
          <p>
            Os dados ficam armazenados em infraestrutura em nuvem com criptografia em
            trânsito e em repouso, com acesso restrito por autenticação e políticas de
            segurança em nível de linha (RLS). Tokens da Meta são renovados
            periodicamente e mantidos protegidos.
          </p>

          <h2 className="pt-2 text-lg font-semibold">4. Compartilhamento</h2>
          <p>
            Não compartilhamos dados com terceiros. A comunicação com a Meta ocorre
            apenas para viabilizar as funcionalidades do produto (receber mensagens,
            publicar conteúdo).
          </p>

          <h2 className="pt-2 text-lg font-semibold">5. Direitos do titular</h2>
          <p>
            Você pode solicitar acesso, correção ou exclusão dos seus dados. Consulte
            também as{" "}
            <Link to="/exclusao-de-dados" className="text-primary underline">
              instruções de exclusão de dados
            </Link>
            .
          </p>

          <h2 className="pt-2 text-lg font-semibold">6. Contato do responsável</h2>
          <p>
            Dúvidas ou solicitações:{" "}
            <a href="mailto:lula1973@gmail.com" className="text-primary underline">
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
