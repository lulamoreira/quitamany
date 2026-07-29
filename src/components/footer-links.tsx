import { Link } from "@tanstack/react-router";

export function FooterLinks() {
  return (
    <footer className="border-t bg-card/50 px-4 py-4 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link to="/privacidade" className="hover:text-foreground hover:underline">
          Privacidade
        </Link>
        <span aria-hidden>·</span>
        <Link to="/exclusao-de-dados" className="hover:text-foreground hover:underline">
          Exclusão de dados
        </Link>
        <span aria-hidden>·</span>
        <Link to="/termos" className="hover:text-foreground hover:underline">
          Termos de Serviço
        </Link>
      </div>
    </footer>
  );
}
