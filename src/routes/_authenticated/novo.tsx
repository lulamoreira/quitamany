import { createFileRoute, useNavigate, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Eye,
  Film,
  Hash,
  Image as ImageIcon,
  Images,
  Loader2,
  Pilcrow,
  Send,
  Upload,
  Video,
  X,
} from "lucide-react";
import { EmojiPicker } from "@/components/emoji-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PostPreview } from "@/components/agenda/post-preview";
import { publicarAgora, executarMotorAgora } from "@/lib/publicador.functions";
import { ehModuloObsoleto, MENSAGEM_VERSAO_OBSOLETA } from "@/lib/versao-obsoleta";
import {
  LIMITE_IMAGEM_BYTES,
  MAX_ITENS_CARROSSEL,
  MIN_ITENS_CARROSSEL,
  normalizarMidiaItens,
  normalizarTipoMidia,
  ROTULO_TIPO_MIDIA,
  type MidiaItem,
  type TipoMidia,
} from "@/lib/midia-post";
import {
  AVISO_DEMORA_BYTES,
  LIMITE_CONVERSAO_BYTES,
  LIMITE_UPLOAD_BYTES,
  formatarTamanho,
  mensagemVideoMuitoGrande,
} from "@/lib/video-limites";


export const Route = createFileRoute("/_authenticated/novo")({
  validateSearch: (s: Record<string, unknown>) => ({ id: (s.id as string) || undefined }),
  head: () => ({ meta: [{ title: "Novo post · QuitaMany" }] }),
  component: NovoPost,
});


const HASHTAG_SETS: Record<string, string> = {
  "Nicho maker":
    "#maker #impressao3d #3dprinting #diy #makercommunity #tecnologia #artesanato #inovacao",
  "Produto e decoração":
    "#decoracao #decoracaocriativa #presente #presentecriativo #decorhome #casa #achadinhos",
  "Loja e comunidade":
    "#lojaonline #compresmall #compredequemfazbem #brasil",
};

/** Formatação de tamanho vem do módulo de limites — um lugar só. */
const mb = formatarTamanho;

function NovoPost() {
  const { id: editId } = Route.useSearch();
  const navigate = useNavigate();
  const [legenda, setLegenda] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [titulo, setTitulo] = useState("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoPath, setVideoPath] = useState<string>("");
  const [agendadoPara, setAgendadoPara] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);
  const [contaUsername, setContaUsername] = useState<string | undefined>(undefined);
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [tipoMidia, setTipoMidia] = useState<TipoMidia>("reels");
  const [imagens, setImagens] = useState<MidiaItem[]>([]);
  const [enviandoImagem, setEnviandoImagem] = useState(false);

  const legendaRef = useRef<HTMLTextAreaElement | null>(null);
  const [publicando, setPublicando] = useState(false);
  const publicarAgoraFn = useServerFn(publicarAgora);
  const executarMotorFn = useServerFn(executarMotorAgora);

  /** Chave estável das imagens: comparar strings evita falso positivo de identidade. */
  const chaveImagens = imagens.map((i) => i.url).join("|");

  // Snapshot do último estado salvo (ou carregado). Comparar contra ele evita
  // avisos em falso, que são piores que a ausência do aviso.
  const estadoAtual = {
    titulo,
    legenda,
    hashtags,
    videoUrl,
    agendadoPara,
    tipoMidia,
    chaveImagens,
  };
  const baseRef = useRef({
    titulo: "",
    legenda: "",
    hashtags: "",
    videoUrl: "",
    agendadoPara: "",
    tipoMidia: "reels" as TipoMidia,
    chaveImagens: "",
  });
  const temAlteracoes = (Object.keys(estadoAtual) as Array<keyof typeof estadoAtual>).some(
    (k) => (estadoAtual[k] || "") !== (baseRef.current[k] || ""),
  );
  const temAlteracoesRef = useRef(temAlteracoes);
  temAlteracoesRef.current = temAlteracoes;


  useEffect(() => {
    let ativo = true;
    supabase
      .from("ig_config")
      .select("conta_username")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo && data?.conta_username) setContaUsername(data.conta_username);
      });
    return () => {
      ativo = false;
    };
  }, []);


  useEffect(() => {
    if (!editId) return;
    supabase
      .from("posts_agendados")
      .select("*")
      .eq("id", editId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const dataHora = data.agendado_para
          ? format(new Date(data.agendado_para), "yyyy-MM-dd'T'HH:mm")
          : "";
        setLegenda(data.legenda || "");
        setHashtags(data.hashtags || "");
        setTitulo(data.titulo || "");
        setVideoUrl(data.video_url || "");
        setVideoPath(data.video_path || "");
        setAgendadoPara(dataHora);
        const tipoSalvo = normalizarTipoMidia((data as { tipo_midia?: unknown }).tipo_midia);
        const itensSalvos = normalizarMidiaItens((data as { midia_itens?: unknown }).midia_itens);
        setTipoMidia(tipoSalvo);
        setImagens(itensSalvos);
        // O que veio do banco já está salvo — não conta como alteração.
        baseRef.current = {
          titulo: data.titulo || "",
          legenda: data.legenda || "",
          hashtags: data.hashtags || "",
          videoUrl: data.video_url || "",
          agendadoPara: dataHora,
          tipoMidia: tipoSalvo,
          chaveImagens: itensSalvos.map((i) => i.url).join("|"),
        };

      });
  }, [editId]);

  // Fechar ou recarregar a aba com alterações pendentes.
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (!temAlteracoesRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  // Sem isto, soltar um arquivo fora da área pontilhada faz o navegador abrir o
  // vídeo em outra aba e o usuário perde o formulário.
  useEffect(() => {
    const bloquear = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", bloquear);
    window.addEventListener("drop", bloquear);
    return () => {
      window.removeEventListener("dragover", bloquear);
      window.removeEventListener("drop", bloquear);
    };
  }, []);

  const descreverErro = (e: unknown): string => {
    if (typeof e === "string") return e;
    if (e && typeof e === "object") {
      const err = e as { message?: unknown; name?: unknown };
      if (typeof err.message === "string" && err.message) return err.message;
      if (typeof err.name === "string" && err.name) return err.name;
      try {
        const json = JSON.stringify(e);
        if (json && json !== "{}") return json;
      } catch {
        /* ignora */
      }
    }
    return String(e);
  };

  const handleUpload = async (fileOriginal: File) => {
    const nome = fileOriginal.name.toLowerCase();
    const pareceVideo =
      fileOriginal.type.startsWith("video/") ||
      /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(nome);
    if (!pareceVideo) {
      toast.error("Selecione um arquivo de vídeo.");
      return;
    }

    // 1) Acima do teto de conversão: só a recusa, sem promessa falsa.
    if (fileOriginal.size > LIMITE_CONVERSAO_BYTES) {
      toast.error(mensagemVideoMuitoGrande(fileOriginal.size));
      return;
    }

    // 2) Haverá conversão? (não é mp4, ou é mp4 acima do teto de upload)
    const jaMp4 = fileOriginal.type === "video/mp4" || nome.endsWith(".mp4");
    const precisaConverter = !jaMp4 || fileOriginal.size > LIMITE_UPLOAD_BYTES;

    // 3) Avisar da demora apenas quando ela realmente vai acontecer.
    if (precisaConverter && fileOriginal.size > AVISO_DEMORA_BYTES) {
      toast.warning(
        `Vídeo de ${formatarTamanho(fileOriginal.size)}. Vamos converter e comprimir aqui mesmo — pode levar alguns minutos, mantenha esta aba aberta.`,
      );
    }

    setUploading(true);
    setProgresso(null);
    try {
      const { prepararVideo } = await import("@/lib/video-converter");
      setProgresso("Preparando conversor…");
      const resultado = await prepararVideo(fileOriginal, ({ ratio, note }) => {
        const pct = Math.round(ratio * 100);
        setProgresso(note ? (ratio > 0 ? `${note} ${pct}%` : note) : `Convertendo… ${pct}%`);
      });

      const file = resultado.arquivo;
      setProgresso("Enviando…");

      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("videos-instagram").upload(path, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });
      if (error) {
        console.error(error);
        toast.error("Falha no upload: " + error.message);
        return;
      }
      const { data } = supabase.storage.from("videos-instagram").getPublicUrl(path);
      setVideoPath(path);
      setVideoUrl(data.publicUrl);
      if (resultado.remuxado) {
        toast.success("Vídeo pronto, sem perda de qualidade.");
      } else if (resultado.comprimido) {
        toast.success(
          `Vídeo pronto: de ${mb(resultado.tamanhoOriginal)} para ${mb(resultado.tamanhoFinal)}.`,
        );
      } else {
        toast.success("Vídeo enviado!");
      }

    } catch (e) {
      console.error(e);
      if (ehModuloObsoleto(e)) {
        toast.error(MENSAGEM_VERSAO_OBSOLETA, {
          action: { label: "Recarregar", onClick: () => window.location.reload() },
          duration: 15000,
        });
        return;
      }
      toast.error("Falha ao processar vídeo: " + descreverErro(e));
    } finally {
      setUploading(false);
      setProgresso(null);
    }
  };

  /**
   * Envia imagens para o Storage (mesmo bucket dos vídeos) e devolve as URLs.
   * Sem conversão: foto vai direto, só validamos tipo e tamanho.
   */
  const handleUploadImagens = async (arquivos: File[], limite: number) => {
    const aceitos = arquivos.slice(0, Math.max(0, limite));
    if (aceitos.length === 0) return;
    setEnviandoImagem(true);
    try {
      const novos: MidiaItem[] = [];
      for (const file of aceitos) {
        if (!/^image\/(jpeg|png)$/.test(file.type)) {
          toast.error(`"${file.name}": use JPEG ou PNG.`);
          continue;
        }
        if (file.size > LIMITE_IMAGEM_BYTES) {
          toast.error(
            `"${file.name}" tem ${formatarTamanho(file.size)} — o limite é ${formatarTamanho(LIMITE_IMAGEM_BYTES)}.`,
          );
          continue;
        }
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage
          .from("videos-instagram")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) {
          console.error(error);
          toast.error("Falha no upload: " + error.message);
          continue;
        }
        const { data } = supabase.storage.from("videos-instagram").getPublicUrl(path);
        novos.push({ url: data.publicUrl });
      }
      if (novos.length > 0) {
        setImagens((atuais) => [...atuais, ...novos].slice(0, MAX_ITENS_CARROSSEL));
        toast.success(novos.length === 1 ? "Imagem enviada!" : `${novos.length} imagens enviadas!`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao enviar imagem: " + descreverErro(e));
    } finally {
      setEnviandoImagem(false);
    }
  };

  /** Troca o formato do post sem perder o que já foi enviado no outro formato. */
  const trocarTipo = (novo: TipoMidia) => {
    setTipoMidia(novo);
    if (novo === "imagem") setImagens((atuais) => atuais.slice(0, 1));
  };

  const setAtalho = (hora: number) => {
    const d = new Date();
    d.setHours(hora, 0, 0, 0);
    setAgendadoPara(format(d, "yyyy-MM-dd'T'HH:mm"));
  };

  /** Insere texto na posição do cursor da legenda, respeitando o limite de 2200. */
  const inserirNaLegenda = (texto: string) => {
    const el = legendaRef.current;
    const inicio = el ? el.selectionStart : legenda.length;
    const fim = el ? el.selectionEnd : legenda.length;
    const novo = legenda.slice(0, inicio) + texto + legenda.slice(fim);
    if (novo.length > 2200) {
      toast.error("A legenda chegou ao limite de 2200 caracteres.");
      return;
    }
    setLegenda(novo);
    const cursor = inicio + texto.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  };

  /**
   * A mídia está completa para ir ao ar?
   * Reels segue exigindo vídeo, como sempre exigiu.
   */
  const midiaPronta =
    tipoMidia === "reels"
      ? Boolean(videoUrl)
      : tipoMidia === "imagem"
        ? imagens.length === 1
        : imagens.length >= MIN_ITENS_CARROSSEL && imagens.length <= MAX_ITENS_CARROSSEL;

  const avisoMidia =
    tipoMidia === "reels"
      ? "Envie um vídeo antes de continuar"
      : tipoMidia === "imagem"
        ? "Envie 1 imagem antes de continuar"
        : `O carrossel precisa de ${MIN_ITENS_CARROSSEL} a ${MAX_ITENS_CARROSSEL} imagens`;

  /** Persiste o post. Devolve o id salvo, ou null em caso de falha. */
  const persistir = async (
    status: "rascunho" | "agendado",
    opcoes?: { silencioso?: boolean },
  ): Promise<string | null> => {
    if (status === "agendado" && !midiaPronta) {
      toast.error(avisoMidia);
      return null;
    }
    if (status === "agendado" && !agendadoPara) {
      toast.error("Escolha data e hora");
      return null;
    }
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      titulo,
      legenda,
      hashtags,
      video_path: videoPath || null,
      video_url: videoUrl || null,
      tipo_midia: tipoMidia,
      // O jsonb aceita qualquer JSON; o cast só satisfaz o tipo gerado.
      midia_itens:
        tipoMidia === "reels"
          ? null
          : (imagens.map((i) => ({ url: i.url })) as unknown as Json),

      agendado_para: agendadoPara ? new Date(agendadoPara).toISOString() : null,
      status,
      criado_por: user.user!.id,
    };
    const res = editId
      ? await supabase.from("posts_agendados").update(payload).eq("id", editId).select("id").single()
      : await supabase.from("posts_agendados").insert(payload).select("id").single();
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return null;
    }
    // Salvo: some o estado "não salvo" antes de qualquer navegação.
    baseRef.current = { titulo, legenda, hashtags, videoUrl, agendadoPara, tipoMidia, chaveImagens };

    temAlteracoesRef.current = false;
    if (!opcoes?.silencioso) {
      toast.success(status === "agendado" ? "Post agendado!" : "Rascunho salvo");
    }
    return res.data?.id ?? editId ?? null;
  };

  const salvar = async (status: "rascunho" | "agendado") => {
    if (await persistir(status)) navigate({ to: "/agenda" });
  };

  /** Salva e enfileira para publicação imediata. Não toca no motor existente. */
  const publicarImediatamente = async () => {
    setConfirmarPublicar(false);
    const id = await persistir("rascunho", { silencioso: true });
    if (!id) return;
    setPublicando(true);
    try {
      const res = await publicarAgoraFn({ data: { id } });
      if (!res.ok) {
        toast.error(res.error || "Não foi possível enviar para publicação");
        return;
      }
      // Motor é restrito a admin: falha de permissão é esperada e ignorada.
      // O Instagram processa o vídeo de forma assíncrona, então só afirmamos
      // que publicou quando o motor confirmar pelo menos uma publicação.
      let publicados = 0;
      try {
        const motor = (await executarMotorFn({})) as { publicados?: number } | undefined;
        publicados = motor?.publicados ?? 0;
      } catch {
        publicados = 0;
      }
      toast.success(
        publicados > 0
          ? "Publicado! Confira no seu perfil."
          : "Enviado para publicação. Sai em instantes, assim que o Instagram terminar de processar o vídeo.",
      );
      temAlteracoesRef.current = false;
      navigate({ to: "/historico" });
    } finally {
      setPublicando(false);
    }
  };


  const bloqueio = useBlocker({
    shouldBlockFn: () => temAlteracoesRef.current,
    enableBeforeUnload: false,
    withResolver: true,
  });

  const salvarESair = async () => {
    if (await persistir("rascunho")) bloqueio.proceed?.();
  };

  const preview = (
    <PostPreview
      tipoMidia={tipoMidia}
      videoUrl={videoUrl || undefined}
      imagens={imagens.map((i) => i.url)}
      legenda={legenda}
      hashtags={hashtags}
      contaUsername={contaUsername}
    />
  );

  const opcoesTipo: Array<{ tipo: TipoMidia; Icone: typeof Film }> = [
    { tipo: "reels", Icone: Film },
    { tipo: "imagem", Icone: ImageIcon },
    { tipo: "carrossel", Icone: Images },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{editId ? "Editar post" : "Novo post"}</h1>
        <p className="text-sm text-muted-foreground">
          {contaUsername
            ? `Prepare a publicação para @${contaUsername}`
            : "Prepare a publicação"}
        </p>
      </header>


      {/* Preview recolhido no mobile */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setPreviewAberto((v) => !v)}
        >
          <Eye className="mr-2 h-4 w-4" />
          {previewAberto ? "Ocultar preview" : "Ver preview"}
        </Button>
        {previewAberto && <div className="mt-3">{preview}</div>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-6 lg:col-span-2">
      <Card>
        <CardContent className="space-y-3 p-4">
          <Label>Tipo de post</Label>
          <div className="grid grid-cols-3 gap-2">
            {opcoesTipo.map(({ tipo, Icone }) => (
              <button
                key={tipo}
                type="button"
                aria-pressed={tipoMidia === tipo}
                onClick={() => trocarTipo(tipo)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tipoMidia === tipo
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/30",
                )}
              >
                <Icone className="h-5 w-5" aria-hidden />
                {ROTULO_TIPO_MIDIA[tipo]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tipoMidia !== "reels" && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <Label>
              {tipoMidia === "imagem"
                ? "Imagem (JPEG ou PNG)"
                : `Imagens do carrossel — ${MIN_ITENS_CARROSSEL} a ${MAX_ITENS_CARROSSEL}`}
            </Label>

            {imagens.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {imagens.map((item, i) => (
                  <li key={item.url} className="relative">
                    <img
                      src={item.url}
                      alt={`Imagem ${i + 1} do post`}
                      className="aspect-square w-full rounded-md border border-border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remover imagem ${i + 1}`}
                      onClick={() => setImagens((a) => a.filter((x) => x.url !== item.url))}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-foreground/80 text-background"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {imagens.length < (tipoMidia === "imagem" ? 1 : MAX_ITENS_CARROSSEL) && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 transition-colors hover:bg-accent/30">
                {enviandoImagem ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {enviandoImagem
                    ? "Enviando…"
                    : tipoMidia === "imagem"
                      ? "Toque para escolher a imagem"
                      : "Toque para adicionar imagens"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Até {formatarTamanho(LIMITE_IMAGEM_BYTES)} por imagem.
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple={tipoMidia === "carrossel"}
                  className="hidden"
                  disabled={enviandoImagem}
                  onChange={(e) => {
                    const arquivos = Array.from(e.target.files ?? []);
                    const limite =
                      (tipoMidia === "imagem" ? 1 : MAX_ITENS_CARROSSEL) - imagens.length;
                    if (arquivos.length) handleUploadImagens(arquivos, limite);
                    e.target.value = "";
                  }}
                />
              </label>
            )}

            {tipoMidia === "carrossel" && (
              <p className="text-[11px] text-muted-foreground">
                Nesta versão o carrossel aceita apenas fotos.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {tipoMidia === "reels" && (
      <Card>
        <CardContent className="space-y-4 p-4">
          <Label>Vídeo — convertemos e comprimimos automaticamente</Label>

          {videoUrl ? (
            <div className="space-y-2">
              <video src={videoUrl} controls className="max-h-64 w-full rounded-md bg-black" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setVideoUrl("");
                  setVideoPath("");
                }}
              >
                Trocar vídeo
              </Button>
            </div>
          ) : (
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 transition-colors",
                arrastando
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent/30",
              )}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!uploading) setArrastando(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!uploading) setArrastando(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setArrastando(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setArrastando(false);
                if (uploading) return;
                const arquivo = e.dataTransfer.files?.[0];
                if (arquivo) handleUpload(arquivo);
              }}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {uploading
                  ? (progresso ?? "Enviando…")
                  : arrastando
                    ? "Solte o vídeo aqui"
                    : "Toque ou arraste um vídeo"}
              </span>
              {!uploading && (
                <span className="text-[11px] text-muted-foreground">
                  MP4, MOV, WebM, MKV, AVI. Vídeos grandes são comprimidos aqui mesmo.
                </span>
              )}
              <input
                type="file"
                accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
            </label>
          )}

        </CardContent>
      </Card>
      )}



      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título interno (opcional)</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legenda">Legenda</Label>
            <Textarea
              id="legenda"
              ref={legendaRef}
              rows={5}
              maxLength={2200}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Escreva a legenda do post…"
            />
            <div className="flex flex-wrap items-center gap-2">
              <EmojiPicker onSelect={inserirNaLegenda} />
              <Button type="button" variant="outline" size="sm" onClick={() => inserirNaLegenda("#")}>
                <Hash className="mr-1.5 h-4 w-4" />
                Hashtag
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inserirNaLegenda("\n\n")}
              >
                <Pilcrow className="mr-1.5 h-4 w-4" />
                Parágrafo
              </Button>
            </div>
            <p className="text-right text-xs text-muted-foreground">{legenda.length}/2200</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hashtags</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sugestões genéricas — clique para adicionar e edite à vontade.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(HASHTAG_SETS).map(([nome, tags]) => (
              <Badge
                key={nome}
                variant="secondary"
                className="cursor-pointer"
                onClick={() =>
                  setHashtags((h) => (h ? h + " " + tags : tags))
                }
              >
                + {nome}
              </Badge>
            ))}
          </div>
          <Textarea
            rows={3}
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#suastags #aqui"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quando publicar?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="datetime-local"
            value={agendadoPara}
            onChange={(e) => setAgendadoPara(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAtalho(12)}>
              Hoje 12h
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAtalho(19)}>
              Hoje 19h
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={() => salvar("rascunho")} disabled={saving} className="flex-1">
          Salvar rascunho
        </Button>
        <Button onClick={() => salvar("agendado")} disabled={saving || publicando} className="flex-1">
          <Video className="mr-2 h-4 w-4" />
          Agendar
        </Button>
        <Button
          variant="secondary"
          onClick={() => setConfirmarPublicar(true)}
          disabled={saving || publicando || !midiaPronta}
          title={midiaPronta ? undefined : avisoMidia}
          className="flex-1"
        >
          {publicando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Publicar agora
        </Button>
      </div>
      {!midiaPronta && (
        <p className="text-xs text-muted-foreground">
          "Publicar agora" fica disponível quando a mídia estiver completa: {avisoMidia.toLowerCase()}.
        </p>
      )}

        </div>

        <aside className="hidden min-w-0 lg:block">
          <div className="sticky top-6 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            {preview}
          </div>
        </aside>
      </div>

      <AlertDialog open={confirmarPublicar} onOpenChange={setConfirmarPublicar}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader className="min-w-0">
            <AlertDialogTitle>Publicar agora?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              O post vai para o Instagram imediatamente e não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="min-w-0 flex-col flex-wrap gap-2 sm:flex-row">
            <AlertDialogCancel disabled={publicando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void publicarImediatamente();
              }}
              disabled={publicando || saving}
            >
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bloqueio.status === "blocked"}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader className="min-w-0">
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Você tem alterações que ainda não foram salvas. Se sair agora, elas serão
              perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="min-w-0 flex-col flex-wrap gap-2 sm:flex-row">
            <AlertDialogCancel onClick={() => bloqueio.reset?.()} disabled={saving}>
              Continuar
            </AlertDialogCancel>
            <Button variant="outline" onClick={() => bloqueio.proceed?.()} disabled={saving}>
              Descartar
            </Button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void salvarESair();
              }}
              disabled={saving}
            >
              Salvar rascunho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
