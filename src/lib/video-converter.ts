// Conversor de vídeo no navegador (webm/mov/etc → mp4 H.264/AAC) via ffmpeg.wasm.
// Carregado sob demanda para não pesar no bundle inicial.

let ffmpegInstance: any = null;

async function getFfmpeg(onLog?: (msg: string) => void) {
  if (ffmpegInstance) return ffmpegInstance;
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  if (onLog) ffmpeg.on("log", ({ message }: { message: string }) => onLog(message));
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export type ConversionProgress = { ratio: number; note?: string };

// Retorna um File .mp4 pronto para upload. Se já for mp4, devolve o próprio arquivo.
export async function garantirMp4(
  file: File,
  onProgress?: (p: ConversionProgress) => void,
): Promise<File> {
  const nome = file.name.toLowerCase();
  const jaMp4 = file.type === "video/mp4" || nome.endsWith(".mp4");
  if (jaMp4) return file;

  onProgress?.({ ratio: 0, note: "Carregando conversor…" });
  const ffmpeg = await getFfmpeg();

  const { fetchFile } = await import("@ffmpeg/util");
  const inputName = "input" + (nome.match(/\.[a-z0-9]+$/)?.[0] ?? ".webm");
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  ffmpeg.on("progress", ({ progress }: { progress: number }) => {
    if (progress >= 0 && progress <= 1) onProgress?.({ ratio: progress });
  });

  onProgress?.({ ratio: 0, note: "Convertendo para MP4…" });
  // H.264 + AAC, faststart, CRF 23 — compatível com Instagram Reels
  await ffmpeg.exec([
    "-i",
    inputName,
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
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  const blob = new Blob([data as any], { type: "video/mp4" });
  const novoNome = file.name.replace(/\.[a-z0-9]+$/i, "") + ".mp4";
  return new File([blob], novoNome, { type: "video/mp4" });
}
