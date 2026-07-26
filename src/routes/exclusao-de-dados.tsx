import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/exclusao-de-dados")({
  head: () => ({
    meta: [
      { title: "Exclusão de Dados · QuitaMany" },
      {
        name: "description",
        content:
          "Como solicitar a remoção completa dos seus dados do QuitaMany. Prazo de 30 dias.",
      },
      { property: "og:title", content: "Exclusão de Dados · QuitaMany" },
      {
        property: "og:description",
        content: "Instruções para solicitar exclusão de dados no QuitaMany.",
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
            Instruções de Exclusão de Dados
          </h1>
          <p className="text-sm text-muted-foreground">QuitaMany</p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            Você pode solicitar a remoção completa dos seus dados tratados pelo
            QuitaMany, incluindo conta Instagram conectada, mensagens, comentários,
            contatos e etiquetas.
          </p>

          <h2 className="pt-2 text-lg font-semibold">Como solicitar</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Envie um e-mail para{" "}
              <a href="mailto:lula1973@gmail.com" className="text-primary underline">
                lula1973@gmail.com
              </a>{" "}
              com o assunto <strong>"Exclusão de dados — QuitaMany"</strong>.
            </li>
            <li>
              Informe o nome de usuário do Instagram e/ou o e-mail associado à conta
              para que possamos localizar seus dados.
            </li>
            <li>Confirme a solicitação respondendo ao nosso e-mail de verificação.</li>
          </ol>

          <h2 className="pt-2 text-lg font-semibold">Prazo</h2>
          <p>
            Concluímos a exclusão em até <strong>30 dias</strong> a contar da
            confirmação. Após esse período, os dados são removidos de forma
            irreversível dos nossos sistemas.
          </p>

          <h2 className="pt-2 text-lg font-semibold">Dúvidas</h2>
          <p>
            Fale conosco pelo mesmo e-mail:{" "}
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
