import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/exclusao-de-dados")({
  head: () => ({
    meta: [
      { title: "Exclusão de Dados · QuitaMany" },
      {
        name: "description",
        content:
          "Como solicitar a remoção completa dos seus dados do QuitaMany. Prazo de atendimento de 30 dias.",
      },
      { property: "og:title", content: "Exclusão de Dados · QuitaMany" },
      {
        property: "og:description",
        content: "Passos para solicitar a exclusão completa dos dados da conta Instagram no QuitaMany.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExclusaoPage,
});

function ExclusaoPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-card p-8 shadow-sm">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Exclusão de Dados
          </h1>
          <p className="text-sm text-muted-foreground">QuitaMany</p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            Você tem o direito de solicitar a remoção completa dos seus dados
            tratados pelo QuitaMany. Isso inclui a conta Instagram conectada, tokens
            de acesso, mensagens diretas, comentários, contatos, etiquetas, posts
            agendados e qualquer outro conteúdo vinculado ao seu uso do aplicativo.
          </p>

          <h2 className="pt-2 text-lg font-semibold">Como solicitar em 3 passos</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Envie um e-mail para{" "}
              <a
                href="mailto:[EMAIL_DE_CONTATO]"
                className="text-foreground underline"
              >
                [EMAIL_DE_CONTATO]
              </a>{" "}
              com o assunto{" "}
              <strong>"Exclusão de dados — QuitaMany"</strong>.
            </li>
            <li>
              No corpo do e-mail, informe o nome de usuário do Instagram
              comercial e/ou o e-mail associado à sua conta no QuitaMany, para que
              possamos localizar seus dados com segurança.
            </li>
            <li>
              Aguarde nosso e-mail de confirmação e responda validando a
              solicitação. A exclusão será processada após essa confirmação.
            </li>
          </ol>

          <h2 className="pt-2 text-lg font-semibold">Prazo de atendimento</h2>
          <p>
            Concluímos a exclusão em até <strong>30 dias</strong> a contar da
            confirmação da solicitação. Após esse período, os dados são removidos de
            forma irreversível dos nossos sistemas ativos. Backups de segurança
            podem permanecer por até 30 dias adicionais, mas também são excluídos no
            ciclo seguinte.
          </p>

          <h2 className="pt-2 text-lg font-semibold">Observações importantes</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              A exclusão dos dados no QuitaMany não exclui publicações, comentários
              ou mensagens já feitas diretamente no Instagram. Para isso, acesse
              sua conta na Meta.
            </li>
            <li>
              Se você for membro de uma equipe, a remoção da sua conta não afeta
              dados de outros usuários nem publicações feitas por outros
              administradores.
            </li>
          </ul>

          <h2 className="pt-2 text-lg font-semibold">Dúvidas</h2>
          <p>
            Fale conosco pelo mesmo e-mail:{" "}
            <a
              href="mailto:[EMAIL_DE_CONTATO]"
              className="text-foreground underline"
            >
              [EMAIL_DE_CONTATO]
            </a>
            .
          </p>
        </section>

        <footer className="border-t pt-4 text-sm">
          <Link to="/" className="text-foreground hover:underline">
            ← Voltar
          </Link>
        </footer>
      </article>
    </div>
  );
}
