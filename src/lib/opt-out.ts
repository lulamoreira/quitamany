// Helpers de opt-out para mensagens recebidas via DM.
// Usa fronteira de palavra (\b) sobre texto normalizado para evitar falsos positivos
// como "comparar", "separar", "preparar".

export function normalizarTexto(t: string): string {
  return (t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const PALAVRAS_PARADA = ["parar", "pare", "sair", "cancelar", "cancela", "stop", "descadastrar"];
export const PALAVRAS_RETORNO = ["voltar", "reativar", "retomar", "start"];

function escapar(p: string) {
  return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function montarRegex(lista: string[]): RegExp {
  return new RegExp(`\\b(?:${lista.map(escapar).join("|")})\\b`, "i");
}

const RE_PARADA = montarRegex(PALAVRAS_PARADA);
const RE_RETORNO = montarRegex(PALAVRAS_RETORNO);

export function ehParada(texto: string): boolean {
  return RE_PARADA.test(normalizarTexto(texto));
}

export function ehRetorno(texto: string): boolean {
  return RE_RETORNO.test(normalizarTexto(texto));
}
