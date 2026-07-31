// Utilitários de imagem no cliente. Reduz fotos de celular antes do upload,
// em vez de simplesmente recusá-las por tamanho ou formato.

export const MAX_DIMENSAO_IMAGEM = 1440;

/**
 * Tenta abrir qualquer imagem que o navegador consiga decodificar (inclui HEIC no Safari/iOS)
 * e devolve um File JPEG redimensionado. Rejeita se o navegador não conseguir decodificar
 * o arquivo original — nesse caso o chamador deve mostrar a orientação de HEIC.
 */
export function reduzirImagem(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_DIMENSAO_IMAGEM / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas não disponível neste navegador.");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Falha ao gerar a imagem reduzida."));
            const novoNome = file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
            resolve(new File([blob], novoNome, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.9,
        );
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Falha ao processar a imagem."));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("NAO_DECODIFICOU"));
    };
    img.src = objectUrl;
  });
}
