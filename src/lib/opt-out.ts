// Helpers de opt-out para mensagens recebidas via DM.
// Só considera opt-out/retorno quando a mensagem contém EXATAMENTE a palavra
// (após normalização removendo acentos e pontuação). Isso evita falsos positivos
// como "não quero cancelar meu pedido" ou "vou sair agora pra academia".

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

export function ehParada(texto: string): boolean {
  const n = normalizarTexto(texto);
  return PALAVRAS_PARADA.some((p) => p === n);
}

export function ehRetorno(texto: string): boolean {
  const n = normalizarTexto(texto);
  return PALAVRAS_RETORNO.some((p) => p === n);
}
