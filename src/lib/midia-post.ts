// Tipos e helpers de mídia de post. Client-safe (usado por telas e preview).

/** Formatos suportados pelo publicador. 'reels' é o legado e o padrão. */
export type TipoMidia = "reels" | "imagem" | "carrossel";

/** Item de mídia. Nesta versão, apenas imagens. */
export interface MidiaItem {
  url: string;
}

export const TIPOS_MIDIA: TipoMidia[] = ["reels", "imagem", "carrossel"];

export const ROTULO_TIPO_MIDIA: Record<TipoMidia, string> = {
  reels: "Reels",
  imagem: "Foto",
  carrossel: "Carrossel",
};

export const MAX_ITENS_CARROSSEL = 10;
export const MIN_ITENS_CARROSSEL = 2;
/** Teto de upload por imagem: acima disso o Instagram costuma recusar. */
export const LIMITE_IMAGEM_BYTES = 8 * 1024 * 1024;

/**
 * Normaliza o campo `tipo_midia` vindo do banco.
 * Registros antigos têm `null`/ausente e devem continuar sendo tratados como Reels.
 */
export function normalizarTipoMidia(valor: unknown): TipoMidia {
  return valor === "imagem" || valor === "carrossel" ? valor : "reels";
}

/**
 * Converte o JSON de `midia_itens` em uma lista segura de itens.
 * Tolerante a dados malformados: descarta o que não tiver `url` string.
 */
export function normalizarMidiaItens(valor: unknown): MidiaItem[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const url = (item as { url?: unknown }).url;
    return typeof url === "string" && url.length > 0 ? [{ url }] : [];
  });
}
