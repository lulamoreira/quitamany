// Utilitários de imagem no cliente. Reduz fotos de celular antes do upload,
// em vez de simplesmente recusá-las por tamanho ou formato.
//
// Estratégia de decodificação (em ordem, cada etapa é um fallback da anterior):
// 1. createImageBitmap(file)  -> caminho rápido; cobre JPEG, JPG, PNG, WebP, GIF
//                                e HEIC no Safari/iOS (decodificador do sistema).
// 2. <img> + object URL       -> navegadores antigos sem createImageBitmap.
// 3. heic-to (WASM)           -> HEIC/HEIF onde o navegador não decodifica
//                                (Chrome/Firefox/Android). Carregado sob demanda.
//
// Depois da decodificação, o desenho no canvas respeita o teto de área do
// iOS Safari (~16.7 MP), que devolve blob nulo em fotos muito grandes.

export const MAX_DIMENSAO_IMAGEM = 1440;

/** Teto de área de canvas seguro no iOS Safari. Acima disso o toBlob volta nulo. */
const MAX_AREA_CANVAS = 16_000_000;

/** Erro sinalizando que nenhuma etapa conseguiu abrir o arquivo. */
export const ERRO_NAO_DECODIFICOU = "NAO_DECODIFICOU";

/** Extensões/mimes tratados como HEIC/HEIF, que pedem conversão via WASM. */
function ehHeic(file: File): boolean {
  const nome = file.name.toLowerCase();
  const tipo = (file.type || "").toLowerCase();
  return (
    nome.endsWith(".heic") ||
    nome.endsWith(".heif") ||
    tipo === "image/heic" ||
    tipo === "image/heif" ||
    tipo === "image/heic-sequence" ||
    tipo === "image/heif-sequence"
  );
}

interface FonteDesenho {
  fonte: CanvasImageSource;
  largura: number;
  altura: number;
  liberar: () => void;
}

async function viaImageBitmap(blob: Blob): Promise<FonteDesenho | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(blob);
    if (!bitmap.width || !bitmap.height) {
      bitmap.close?.();
      return null;
    }
    return {
      fonte: bitmap,
      largura: bitmap.width,
      altura: bitmap.height,
      liberar: () => bitmap.close?.(),
    };
  } catch {
    return null;
  }
}

function viaElementoImg(blob: Blob): Promise<FonteDesenho | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
        return;
      }
      resolve({
        fonte: img,
        largura: img.naturalWidth,
        altura: img.naturalHeight,
        liberar: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

/** Converte HEIC/HEIF em JPEG usando WASM, apenas quando realmente necessário. */
async function converterHeic(file: File): Promise<Blob | null> {
  try {
    const { heicTo } = await import("heic-to");
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
    return blob ?? null;
  } catch (e) {
    console.error("Falha ao converter HEIC:", e);
    return null;
  }
}

async function abrirImagem(file: File): Promise<FonteDesenho | null> {
  // HEIC no Chrome/Android falha nas duas primeiras etapas; tentar antes economiza tempo.
  if (ehHeic(file)) {
    const convertido = (await converterHeic(file)) ?? file;
    return (await viaImageBitmap(convertido)) ?? (await viaElementoImg(convertido));
  }
  const direto = (await viaImageBitmap(file)) ?? (await viaElementoImg(file));
  if (direto) return direto;
  // Alguns arquivos HEIC chegam sem extensão e sem mime confiável: última tentativa.
  const convertido = await converterHeic(file);
  if (!convertido) return null;
  return (await viaImageBitmap(convertido)) ?? (await viaElementoImg(convertido));
}

function calcularDestino(largura: number, altura: number): { w: number; h: number } {
  let escala = Math.min(1, MAX_DIMENSAO_IMAGEM / Math.max(largura, altura));
  // Segundo teto: área total do canvas (limite do iOS Safari).
  const area = largura * escala * (altura * escala);
  if (area > MAX_AREA_CANVAS) escala *= Math.sqrt(MAX_AREA_CANVAS / area);
  return {
    w: Math.max(1, Math.round(largura * escala)),
    h: Math.max(1, Math.round(altura * escala)),
  };
}

function canvasParaJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    } catch {
      resolve(null);
    }
  });
}

/** Fallback quando toBlob devolve nulo (alguns Safari antigos). */
function dataUrlParaBlob(canvas: HTMLCanvasElement): Blob | null {
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "image/jpeg" });
  } catch {
    return null;
  }
}

/**
 * Abre qualquer imagem que o navegador (ou o conversor HEIC) consiga decodificar
 * e devolve um File JPEG redimensionado, pronto para o Instagram.
 * Rejeita com ERRO_NAO_DECODIFICOU só quando nenhuma estratégia funciona —
 * nesse caso o chamador deve orientar o usuário a converter para JPG.
 */
export async function reduzirImagem(file: File): Promise<File> {
  const aberta = await abrirImagem(file);
  if (!aberta) throw new Error(ERRO_NAO_DECODIFICOU);

  try {
    const { w, h } = calcularDestino(aberta.largura, aberta.altura);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não disponível neste navegador.");
    ctx.drawImage(aberta.fonte, 0, 0, w, h);

    const blob = (await canvasParaJpeg(canvas)) ?? dataUrlParaBlob(canvas);
    if (!blob || blob.size === 0) throw new Error("Falha ao gerar a imagem reduzida.");

    const novoNome = file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    return new File([blob], novoNome || "foto.jpg", { type: "image/jpeg" });
  } finally {
    aberta.liberar();
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers usados pelo módulo "Fotos com IA" (geração/recolorização).
// Separados de reduzirImagem: aqui o alvo é um data URL enviado ao gateway de IA,
// não um File para o Storage.
// ───────────────────────────────────────────────────────────────────────────────

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DIMENSION = 1536;
export type ImageValidation = { ok: true } | { ok: false; message: string };

export function validateFile(file: File): ImageValidation {
  const name = file.name.toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif") || /heic|heif/.test(file.type)) {
    return {
      ok: false,
      message:
        "Formato HEIC não suportado. No iPhone: Ajustes > Câmera > Formatos > Mais Compatível, ou converta para JPG.",
    };
  }
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false, message: "Formato inválido. Envie JPG, PNG ou WEBP." };
  }
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: "Arquivo muito grande. O limite é 10MB." };
  return { ok: true };
}

export function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas não disponível neste navegador.");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Falha ao processar a imagem."));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler esta imagem."));
    };
    img.src = objectUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "objeto"
  );
}
