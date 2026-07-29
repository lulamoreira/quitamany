/**
 * Detecta erros causados por um bundle antigo tentando buscar um chunk
 * que não existe mais depois de um novo deploy.
 */
const PADROES = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
];

export function ehModuloObsoleto(erro: unknown): boolean {
  let texto = "";
  if (typeof erro === "string") texto = erro;
  else if (erro && typeof erro === "object") {
    const e = erro as { message?: unknown };
    if (typeof e.message === "string") texto = e.message;
  }
  if (!texto) return false;
  const alvo = texto.toLowerCase();
  return PADROES.some((p) => alvo.includes(p));
}

export const MENSAGEM_VERSAO_OBSOLETA =
  "Uma versão nova do app foi publicada. Recarregue para continuar.";
