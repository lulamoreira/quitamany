// Limites e textos de vídeo em UM lugar só.
// Este módulo NÃO importa ffmpeg — pode ser importado estaticamente na tela
// sem puxar o conversor (que é pesado e carregado sob demanda).

/** Teto do arquivo final enviado ao storage. */
export const LIMITE_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

/** Acima disso o navegador não dá conta de converter. */
export const LIMITE_CONVERSAO_BYTES = 120 * 1024 * 1024; // 120 MB

/** A partir daqui vale avisar que a conversão vai demorar. */
export const AVISO_DEMORA_BYTES = 50 * 1024 * 1024; // 50 MB

/** KB abaixo de 1 MB, MB acima — evita o antigo "0.0 MB". */
export function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Texto único de recusa por tamanho — usado pela tela e pelo conversor. */
export function mensagemVideoMuitoGrande(bytes: number): string {
  return `Este vídeo tem ${formatarTamanho(bytes)}. A conversão acontece dentro do navegador e não dá conta de arquivos acima de ${formatarTamanho(
    LIMITE_CONVERSAO_BYTES,
  )}. Reduza o vídeo antes de enviar — cortar a duração costuma resolver, e lembre que Reels aceita no máximo 90 segundos.`;
}
