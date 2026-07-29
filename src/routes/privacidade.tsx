import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade · QuitaMany" },
      {
        name: "description",
        content:
          "Política de Privacidade do QuitaMany: dados do Instagram, armazenamento, exclusão e contato.",
      },
      { property: "og:title", content: "Política de Privacidade · QuitaMany" },
      {
        property: "og:description",
        content: "Como o QuitaMany acessa, armazena e protege dados da conta Instagram comercial.",
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
            QuitaMany · Última atualização: 27/07/2026
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            O QuitaMany é uma ferramenta de automação de publicações e atendimento
            para contas comerciais do Instagram. Ao conectar sua conta do Instagram
            ao nosso aplicativo, você nos autoriza a acessar determinados dados
            essenciais para o funcionamento do serviço.
          </p>

          <h2 className="pt-2 text-lg font-semibold">1. Dados que acessamos</h2>
          <p>Quando você conecta sua conta comercial do Instagram, o QuitaMany acessa:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Informações do perfil comercial:</strong> nome de usuário
              (@sualoja, por exemplo), nome da página, ID da página e foto do
              perfil.
            </li>
            <li>
              <strong>Mensagens diretas (DMs):</strong> mensagens recebidas e
              enviadas pelo Instagram Direct, incluindo remetente, texto e
              identificador da conversa.
            </li>
            <li>
              <strong>Comentários:</strong> comentários publicados nas publicações
              da página conectada, nome do autor do comentário e o texto do
              comentário.
            </li>
            <li>
              <strong>Publicações:</strong> identificadores de posts, reels e mídias
              publicadas, necessários para agendamento e publicação automática.
            </li>
            <li>
              <strong>Token de acesso:</strong> token emitido pela Meta (Facebook /
              Instagram) para ler mensagens, comentários e publicar conteúdo em seu
              nome.
            </li>
          </ul>

          <h2 className="pt-2 text-lg font-semibold">2. Dados que armazenamos</h2>
          <p>Armazenamos apenas o que é necessário para operar o serviço:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Dados da conta conectada (nome de usuário, ID da página, token de
              acesso e data de renovação do token).
            </li>
            <li>
              Contatos que interagem com a página (nome de exibição do Instagram,
              ID do contato e etiquetas atribuídas por você).
            </li>
            <li>
              Conversas e mensagens trocadas pelo Direct e comentários capturados
              para atendimento.
            </li>
            <li>
              Conteúdos criados por você no aplicativo (rascunhos, legendas,
              hashtags, vídeos enviados para agendamento e histórico de publicações).
            </li>
          </ul>

          <h2 className="pt-2 text-lg font-semibold">3. Tempo de armazenamento</h2>
          <p>
            Os dados são mantidos enquanto sua conta estiver ativa e conectada ao
            QuitaMany. Se você desconectar sua página do Instagram, excluir sua
            conta ou solicitar a remoção dos dados, os registros correspondentes são
            apagados em até <strong>30 dias</strong>. Logs técnicos e registros de
            webhook podem ser conservados por até 30 dias para fins de segurança e
            diagnóstico.
          </p>

          <h2 className="pt-2 text-lg font-semibold">4. Compartilhamento com terceiros</h2>
          <p>
            <strong>Não vendemos, alugamos nem compartilhamos seus dados com
            terceiros.</strong> A única transferência de informações ocorre com a
            Meta (Facebook / Instagram), por meio da API oficial, e apenas para
            viabilizar as funcionalidades do aplicativo: receber mensagens,
            comentários e publicar conteúdo na página conectada.
          </p>

          <h2 className="pt-2 text-lg font-semibold">5. Segurança</h2>
          <p>
            Os dados são armazenados em infraestrutura em nuvem com criptografia em
            trânsito e em repouso. O acesso é restrito por autenticação e políticas
            de segurança em nível de linha (RLS), que garantem que cada usuário só
            veja o que lhe pertence. Tokens de acesso da Meta são renovados
            periodicamente e mantidos fora do alcance do frontend.
          </p>

          <h2 className="pt-2 text-lg font-semibold">6. Como solicitar exclusão</h2>
          <p>
            Você pode pedir a remoção completa dos seus dados a qualquer momento. O
            procedimento está detalhado na página{" "}
            <Link to="/exclusao-de-dados" className="text-foreground underline">
              Exclusão de Dados
            </Link>
            .
          </p>

          <h2 className="pt-2 text-lg font-semibold">7. Contato do responsável</h2>
          <p>
            Dúvidas, solicitações ou exercício de direitos:{" "}
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
