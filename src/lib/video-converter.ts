// Conversor de vídeo no navegador (webm/mov/avi/… → mp4 H.264/AAC) via ffmpeg.wasm.
// Carregado sob demanda para não pesar no bundle inicial.
//
// IMPORTANTE: `classWorkerURL` é obrigatório. O Vite empacota o worker do
// @ffmpeg/ffmpeg como worker de MÓDULO, mas o núcleo UMD só pode ser carregado
// por um worker CLÁSSICO (importScripts). Sem isso o worker morre antes de
// inicializar e a conversão falha silenciosamente.

import wasmAsset from "@/assets/ffmpeg-core.wasm.asset.json";

export const LIMITE_BYTES = 100 * 1024 * 1024; // 100 MB

let ffmpegInstance: any = null;
let carregando: Promise<any> | null = null;

async function getFfmpeg(): Promise<any> {
  if (ffmpegInstance) return ffmpegInstance;
  if (carregando) return carregando;

  carregando = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      classWorkerURL: "/ffmpeg/814.ffmpeg.js",
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: wasmAsset.url,
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await carregando;
  } finally {
    carregando = null;
  }
}

export type ConversionProgress = { ratio: number; note?: string };

export type ResultadoPreparo = {
  arquivo: File;
  comprimido: boolean;
  tamanhoOriginal: number;
  tamanhoFinal: number;
};

export function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function extensaoDe(nome: string): string {
  return nome.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ".mp4";
}

async function reencodar(
  ffmpeg: any,
  inputName: string,
  args: string[],
  onProgress?: (p: ConversionProgress) => void,
  nota?: string,
): Promise<Uint8Array> {
  const outputName = `saida-${Date.now()}.mp4`;
  const handler = ({ progress }: { progress: number }) => {
    if (progress >= 0 && progress <= 1) onProgress?.({ ratio: progress, note: nota });
  };
  ffmpeg.on("progress", handler);
  try {
    await ffmpeg.exec(["-i", inputName, ...args, outputName]);
    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
    await ffmpeg.deleteFile(outputName).catch(() => {});
    return data;
  } finally {
    ffmpeg.off?.("progress", handler);
  }
}

const ARGS_PADRAO = [
  "-vf",
  "scale='min(1080,iw)':-2",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  "23",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
];

const ARGS_FORTE = [
  "-vf",
  "scale='min(720,iw)':-2",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  "30",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-c:a",
  "aac",
  "-b:a",
  "96k",
];

/**
 * Garante um MP4 dentro do limite de upload, comprimindo em escada quando preciso.
 */
export async function prepararVideo(
  fileOriginal: File,
  onProgress?: (p: ConversionProgress) => void,
): Promise<ResultadoPreparo> {
  const tamanhoOriginal = fileOriginal.size;
  const nome = fileOriginal.name.toLowerCase();
  const jaMp4 = fileOriginal.type === "video/mp4" || nome.endsWith(".mp4");

  // ESTÁGIO 0 — caminho rápido
  if (jaMp4 && tamanhoOriginal <= LIMITE_BYTES) {
    return {
      arquivo: fileOriginal,
      comprimido: false,
      tamanhoOriginal,
      tamanhoFinal: tamanhoOriginal,
    };
  }

  onProgress?.({ ratio: 0, note: "Preparando conversor…" });
  const ffmpeg = await getFfmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const inputName = `entrada-${Date.now()}${extensaoDe(fileOriginal.name)}`;
  await ffmpeg.writeFile(inputName, await fetchFile(fileOriginal));

  try {
    // ESTÁGIO 1 — conversão padrão
    onProgress?.({ ratio: 0, note: "Convertendo…" });
    let data = await reencodar(ffmpeg, inputName, ARGS_PADRAO, onProgress, "Convertendo…");

    // ESTÁGIO 2 — compressão forte
    if (data.byteLength > LIMITE_BYTES) {
      onProgress?.({ ratio: 0, note: "Ainda está grande, comprimindo mais…" });
      data = await reencodar(
        ffmpeg,
        inputName,
        ARGS_FORTE,
        onProgress,
        "Ainda está grande, comprimindo mais…",
      );
    }

    // ESTÁGIO 3 — desistência explícita
    if (data.byteLength > LIMITE_BYTES) {
      throw new Error(
        `Mesmo comprimido o vídeo ficou com ${mb(data.byteLength)} MB (limite de ${mb(
          LIMITE_BYTES,
        )} MB). Corte a duração do vídeo e tente de novo.`,
      );
    }

    const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });
    const novoNome = fileOriginal.name.replace(/\.[a-z0-9]+$/i, "") + ".mp4";
    const arquivo = new File([blob], novoNome, { type: "video/mp4" });

    return {
      arquivo,
      comprimido: true,
      tamanhoOriginal,
      tamanhoFinal: arquivo.size,
    };
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
  }
}

/** Compatibilidade com o uso antigo. */
export async function garantirMp4(
  file: File,
  onProgress?: (p: ConversionProgress) => void,
): Promise<File> {
  const { arquivo } = await prepararVideo(file, onProgress);
  return arquivo;
}
