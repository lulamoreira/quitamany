import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, Video } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/novo")({
  validateSearch: (s: Record<string, unknown>) => ({ id: (s.id as string) || undefined }),
  head: () => ({ meta: [{ title: "Novo post · Publicador" }] }),
  component: NovoPost,
});

const HASHTAG_SETS: Record<string, string> = {
  "Nicho maker":
    "#maker #impressao3d #3dprinting #diy #makercommunity #tecnologia #artesanato #inovacao",
  "Produto e decoração":
    "#decoracao #decoracaocriativa #presente #presentecriativo #decorhome #casa #achadinhos",
  "Loja e comunidade":
    "#quitanda3d #lojaonline #compresmall #compredequemfazbem #brasil",
};

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

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


  useEffect(() => {
    if (!editId) return;
    supabase
      .from("posts_agendados")
      .select("*")
      .eq("id", editId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setLegenda(data.legenda || "");
        setHashtags(data.hashtags || "");
        setTitulo(data.titulo || "");
        setVideoUrl(data.video_url || "");
        setVideoPath(data.video_path || "");
        if (data.agendado_para) {
          const d = new Date(data.agendado_para);
          setAgendadoPara(format(d, "yyyy-MM-dd'T'HH:mm"));
        }
      });
  }, [editId]);

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

    if (fileOriginal.size > 200 * 1024 * 1024) {
      toast.warning(
        `Vídeo grande (${mb(fileOriginal.size)} MB). Vamos comprimir automaticamente — isso pode levar alguns minutos, mantenha esta aba aberta.`,
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
      if (resultado.comprimido) {
        toast.success(
          `Vídeo pronto: de ${mb(resultado.tamanhoOriginal)} MB para ${mb(resultado.tamanhoFinal)} MB.`,
        );
      } else {
        toast.success("Vídeo enviado!");
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao processar vídeo: " + descreverErro(e));
    } finally {
      setUploading(false);
      setProgresso(null);
    }
  };


  const setAtalho = (hora: number) => {
    const d = new Date();
    d.setHours(hora, 0, 0, 0);
    setAgendadoPara(format(d, "yyyy-MM-dd'T'HH:mm"));
  };

  const salvar = async (status: "rascunho" | "agendado") => {
    if (status === "agendado" && !videoUrl) return toast.error("Envie um vídeo antes de agendar");
    if (status === "agendado" && !agendadoPara) return toast.error("Escolha data e hora");
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      titulo,
      legenda,
      hashtags,
      video_path: videoPath || null,
      video_url: videoUrl || null,
      agendado_para: agendadoPara ? new Date(agendadoPara).toISOString() : null,
      status,
      criado_por: user.user!.id,
    };
    const res = editId
      ? await supabase.from("posts_agendados").update(payload).eq("id", editId)
      : await supabase.from("posts_agendados").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(status === "agendado" ? "Post agendado!" : "Rascunho salvo");
    navigate({ to: "/agenda" });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{editId ? "Editar post" : "Novo post"}</h1>
        <p className="text-sm text-muted-foreground">Prepare o Reel para @quitanda3d</p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Label>Vídeo (MP4, MOV ou WebM — convertemos automaticamente)</Label>
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
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 hover:bg-accent/30">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {uploading ? (progresso ?? "Enviando…") : "Toque para escolher um vídeo"}
              </span>
              {!uploading && (
                <span className="text-[11px] text-muted-foreground">
                  Aceita MP4, MOV, WebM, MKV. Até 200 MB (converte para MP4 aqui mesmo).
                </span>
              )}
              <input
                type="file"
                accept="video/*,.webm,.mkv,.mov"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
            </label>
          )}

        </CardContent>
      </Card>

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
              rows={5}
              maxLength={2200}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Escreva a legenda do post…"
            />
            <p className="text-right text-xs text-muted-foreground">{legenda.length}/2200</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hashtags</CardTitle>
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
        <Button onClick={() => salvar("agendado")} disabled={saving} className="flex-1">
          <Video className="mr-2 h-4 w-4" />
          Agendar
        </Button>
      </div>
    </div>
  );
}
