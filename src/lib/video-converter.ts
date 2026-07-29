// Conversor de vídeo no navegador (webm/mov/avi/… → mp4 H.264/AAC) via ffmpeg.wasm.
// Carregado sob demanda para não pesar no bundle inicial.
//
// IMPORTANTE: o @ffmpeg/ffmpeg 0.12.x cria o worker SEMPRE como worker de
// MÓDULO. Em worker de módulo não existe `importScripts`, então o núcleo UMD
// nunca carrega ("Cannot find module"). Por isso apontamos `classWorkerURL`
// para o worker ESM hospedado localmente (worker precisa ser da mesma origem)
// e `coreURL` para o build ESM do núcleo (o UMD é incompatível).

import wasmAsset from "@/assets/ffmpeg-core.wasm.asset.json";
import {
  AVISO_DEMORA_BYTES,
  LIMITE_CONVERSAO_BYTES,
  LIMITE_UPLOAD_BYTES,
  formatarTamanho,
  mensagemVideoMuitoGrande,
} from "@/lib/video-limites";

export {
  AVISO_DEMORA_BYTES,
  LIMITE_CONVERSAO_BYTES,
  LIMITE_UPLOAD_BYTES,
  formatarTamanho,
  mensagemVideoMuitoGrande,
};

/** Compatibilidade com o nome antigo do teto de upload. */
export const LIMITE_BYTES = LIMITE_UPLOAD_BYTES;

/** Tempo máximo sem nenhum evento de progresso antes de abortar. */
const TIMEOUT_SEM_PROGRESSO_MS = 90_000;
/** Tempo máximo total de uma conversão. */
const TIMEOUT_TOTAL_MS = 10 * 60_000;

const MSG_TRAVOU =
  "A conversão travou (o vídeo provavelmente é pesado demais para o navegador). Tente um arquivo menor ou mais curto.";

let ffmpegInstance: any = null;
let carregando: Promise<any> | null = null;

async function getFfmpeg(): Promise<any> {
  if (ffmpegInstance) return ffmpegInstance;
  if (carregando) return carregando;

  carregando = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      classWorkerURL: "/ffmpeg/esm/worker.js",
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
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
  /** true quando só trocamos o contêiner (sem recompressão, sem perda). */
  remuxado?: boolean;
  tamanhoOriginal: number;
  tamanhoFinal: number;
};

export function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** Log padronizado de medição de cada etapa. */
function medir(etapa: string, inicio: number, antes: number, depois: number, extra = "") {
  const s = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`[video] ${etapa}: ${s}s, ${mb(antes)} MB -> ${mb(depois)} MB${extra}`);
}



/** Descarta a instância (worker possivelmente morto) para a próxima tentativa começar limpa. */
function descartarInstancia() {
  const atual = ffmpegInstance;
  ffmpegInstance = null;
  carregando = null;
  try {
    atual?.terminate?.();
  } catch {
    /* ignora */
  }
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
  let ultimoProgresso = Date.now();
  const inicio = Date.now();

  const handler = ({ progress }: { progress: number }) => {
    ultimoProgresso = Date.now();
    if (progress >= 0 && progress <= 1) onProgress?.({ ratio: progress, note: nota });
  };
  ffmpeg.on("progress", handler);

  // Cronômetro de segurança: nenhuma conversão pode ficar pendurada para sempre.
  let vigia: ReturnType<typeof setInterval> | undefined;
  const travou = new Promise<never>((_, reject) => {
    vigia = setInterval(() => {
      const agora = Date.now();
      if (
        agora - ultimoProgresso > TIMEOUT_SEM_PROGRESSO_MS ||
        agora - inicio > TIMEOUT_TOTAL_MS
      ) {
        reject(new Error(MSG_TRAVOU));
      }
    }, 5_000);
  });

  try {
    await Promise.race([ffmpeg.exec(["-i", inputName, ...args, outputName]), travou]);
    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
    await ffmpeg.deleteFile(outputName).catch(() => {});
    return data;
  } catch (e) {
    descartarInstancia();
    throw e;
  } finally {
    if (vigia) clearInterval(vigia);
    ffmpeg.off?.("progress", handler);
  }
}

/**
 * Troca só o contêiner, sem descomprimir nada. Funciona quando a origem já é
 * H.264 + AAC (caso da maioria dos vídeos de celular) e leva segundos.
 */
const ARGS_REMUX = ["-c", "copy", "-movflags", "+faststart"];

const ARGS_PADRAO = [
  "-vf",
  "scale='min(1080,iw)':-2",
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
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

  // Recusa cedo: acima disso a conversão no navegador é falha garantida.
  if (tamanhoOriginal > LIMITE_CONVERSAO_BYTES) {
    throw new Error(mensagemVideoMuitoGrande(tamanhoOriginal));
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
        `Mesmo comprimido o vídeo ficou com ${formatarTamanho(data.byteLength)} (limite de ${formatarTamanho(
          LIMITE_BYTES,
        )}). Corte a duração do vídeo e tente de novo.`,
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
