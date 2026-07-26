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

export const Route = createFileRoute("/_authenticated/publicador/novo")({
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
  const [saving, setSaving] = useState(false);

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

  const handleUpload = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error("O vídeo precisa ter até 100 MB");
      return;
    }
    setUploading(true);
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("videos-instagram").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      setUploading(false);
      return toast.error("Falha no upload: " + error.message);
    }
    const { data } = supabase.storage.from("videos-instagram").getPublicUrl(path);
    setVideoPath(path);
    setVideoUrl(data.publicUrl);
    setUploading(false);
    toast.success("Vídeo enviado!");
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
    navigate({ to: "/publicador" });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{editId ? "Editar post" : "Novo post"}</h1>
        <p className="text-sm text-muted-foreground">Prepare o Reel para @quitanda3d</p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Label>Vídeo (MP4, até 100 MB)</Label>
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
                {uploading ? "Enviando..." : "Toque para escolher um vídeo"}
              </span>
              <input
                type="file"
                accept="video/mp4"
                className="hidden"
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
