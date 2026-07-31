import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Loader2,
  Pipette,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { criarRascunhoDeImagens } from "@/lib/fotos-ia.functions";
import {
  dataUrlToBlob,
  downloadBlob,
  resizeToDataUrl,
  slugify,
  validateFile,
} from "@/lib/image-utils";
import { DesktopPageHeader } from "@/components/desktop-shell";

export const Route = createFileRoute("/_authenticated/gerar-fotos")({
  head: () => ({
    meta: [
      { title: "Fotos com IA · QuitaMany" },
      {
        name: "description",
        content:
          "Gere variações de cor da sua foto de produto com IA e transforme os resultados em post ou carrossel no Instagram.",
      },
    ],
  }),
  component: GerarFotos,
});

const MAX_COLORS = 12;
const CHAVE_CORES_CUSTOM = "fotos-ia-cores-custom";

type Familia = { nome: string; cores: string[] };

const FAMILIAS: Familia[] = [
  { nome: "Vermelhos", cores: ["#E11D48", "#DC2626", "#991B1B"] },
  { nome: "Laranjas", cores: ["#F97316", "#EA580C", "#C2410C"] },
  { nome: "Amarelos", cores: ["#FACC15", "#EAB308", "#CA8A04"] },
  { nome: "Verdes", cores: ["#22C55E", "#16A34A", "#065F46"] },
  { nome: "Azuis", cores: ["#3B82F6", "#1D4ED8", "#0E7490"] },
  { nome: "Roxos", cores: ["#8B5CF6", "#6D28D9", "#4C1D95"] },
  { nome: "Rosas", cores: ["#EC4899", "#DB2777", "#F9A8D4"] },
  { nome: "Neutros", cores: ["#FFFFFF", "#9CA3AF", "#111827"] },
];

type Resultado = {
  hex: string;
  status: "fila" | "gerando" | "ok" | "erro";
  imageUrl?: string;
  erro?: string;
};

// ── cor: conversões HSL para gerar variações ──────────────────────────────────
function hexParaHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslParaHex(h: number, s: number, l: number): string {
  const sn = Math.min(100, Math.max(0, s)) / 100;
  const ln = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r1, g1, b1] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = ln - c / 2;
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`.toUpperCase();
}

function variacoesDe(hex: string): string[] {
  const [h, s, l] = hexParaHsl(hex);
  return [
    hslParaHex(h, s, l + 18),
    hslParaHex(h, s, l - 18),
    hslParaHex(h, s - 40, l),
    hslParaHex(h, s + 30, l),
  ];
}

function ehHex(valor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valor);
}

// ── componente ────────────────────────────────────────────────────────────────
function GerarFotos() {
  const navigate = useNavigate();
  const criarRascunho = useServerFn(criarRascunhoDeImagens);

  const [imageBase64, setImageBase64] = useState("");
  const [identificando, setIdentificando] = useState(false);
  const [objeto, setObjeto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [corrigindo, setCorrigindo] = useState(false);
  const [objetoManual, setObjetoManual] = useState("");

  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [custom, setCustom] = useState<string[]>([]);
  const [novaCor, setNovaCor] = useState("#3B82F6");
  const [novoHex, setNovoHex] = useState("#3B82F6");
  const [conta, setConta] = useState(false);

  const [gerando, setGerando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [comparar, setComparar] = useState<Resultado | null>(null);

  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [criando, setCriando] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(CHAVE_CORES_CUSTOM);
      if (bruto) {
        const lista = JSON.parse(bruto);
        if (Array.isArray(lista)) setCustom(lista.filter((c) => typeof c === "string" && ehHex(c)));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const salvarCustom = (lista: string[]) => {
    setCustom(lista);
    try {
      window.localStorage.setItem(CHAVE_CORES_CUSTOM, JSON.stringify(lista));
    } catch {
      /* ignore */
    }
  };

  const objetoFinal = (objetoManual.trim() || objeto).trim();

  const identificar = useCallback(async (dataUrl: string) => {
    setIdentificando(true);
    setObjeto("");
    setDescricao("");
    setObjetoManual("");
    try {
      const resp = await fetch("/api/identify-objeto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const body = (await resp.json()) as { objeto?: string; descricao?: string; error?: string };
      if (!resp.ok) throw new Error(body.error || "Falha ao identificar o objeto.");
      setObjeto(body.objeto || "objeto principal");
      setDescricao(body.descricao || "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao identificar o objeto.");
      setObjeto("objeto principal");
    } finally {
      setIdentificando(false);
    }
  }, []);

  const receberArquivo = useCallback(
    async (file: File) => {
      const v = validateFile(file);
      if (!v.ok) {
        toast.error(v.message);
        return;
      }
      try {
        const dataUrl = await resizeToDataUrl(file);
        setImageBase64(dataUrl);
        setResultados([]);
        setEscolhidas([]);
        await identificar(dataUrl);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível ler esta imagem.");
      }
    },
    [identificar],
  );

  const alternarCor = (hex: string) => {
    setSelecionadas((atual) => {
      if (atual.includes(hex)) return atual.filter((c) => c !== hex);
      if (atual.length >= MAX_COLORS) {
        toast.error(`Limite de ${MAX_COLORS} cores por geração.`);
        return atual;
      }
      return [...atual, hex];
    });
  };

  // Conta-gotas: EyeDropper quando existir; senão, clique na própria foto.
  const usarContaGotas = async () => {
    const EyeDropper = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } })
      .EyeDropper;
    if (EyeDropper) {
      try {
        const { sRGBHex } = await new EyeDropper().open();
        const hex = sRGBHex.toUpperCase();
        if (ehHex(hex)) {
          if (!custom.includes(hex)) salvarCustom([...custom, hex]);
          alternarCor(hex);
        } else {
          toast.error("Não foi possível ler essa cor.");
        }
      } catch {
        /* usuário cancelou */
      }
      return;
    }
    if (!imageBase64) {
      toast.error("Envie uma foto para usar o conta-gotas.");
      return;
    }
    setConta(true);
    toast.info("Clique num ponto da foto para capturar a cor.");
  };

  const capturarDaFoto = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!conta) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Canvas não disponível neste navegador.");
      setConta(false);
      return;
    }
    ctx.drawImage(img, 0, 0);
    const [r, g, b] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    setConta(false);
    if (!custom.includes(hex)) salvarCustom([...custom, hex]);
    alternarCor(hex);
    toast.success(`Cor ${hex} capturada.`);
  };

  const adicionarCustom = () => {
    const hex = novoHex.trim().toUpperCase();
    if (!ehHex(hex)) {
      toast.error("Informe um hex válido, como #1E62F0.");
      return;
    }
    if (!custom.includes(hex)) salvarCustom([...custom, hex]);
    alternarCor(hex);
  };

  // Geração SEQUENCIAL: paralelizar estoura o rate limit do gateway.
  const gerarUma = useCallback(
    async (hex: string) => {
      setResultados((r) => r.map((x) => (x.hex === hex ? { ...x, status: "gerando", erro: undefined } : x)));
      try {
        const resp = await fetch("/api/recolor-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64, objeto: objetoFinal, hex }),
        });
        const body = (await resp.json()) as { imageUrl?: string; error?: string };
        if (!resp.ok || !body.imageUrl) throw new Error(body.error || "Falha na geração.");
        setResultados((r) =>
          r.map((x) => (x.hex === hex ? { ...x, status: "ok", imageUrl: body.imageUrl } : x)),
        );
      } catch (e) {
        setResultados((r) =>
          r.map((x) =>
            x.hex === hex
              ? { ...x, status: "erro", erro: e instanceof Error ? e.message : "Falha na geração." }
              : x,
          ),
        );
      }
    },
    [imageBase64, objetoFinal],
  );

  const gerar = async () => {
    if (!imageBase64 || selecionadas.length === 0) return;
    setGerando(true);
    setEscolhidas([]);
    setResultados(selecionadas.map((hex) => ({ hex, status: "fila" })));
    for (const hex of selecionadas) {
      await gerarUma(hex);
    }
    setGerando(false);
  };

  const baixar = (r: Resultado) => {
    if (!r.imageUrl) return;
    downloadBlob(
      dataUrlToBlob(r.imageUrl),
      `colorswap-${slugify(objetoFinal)}-${r.hex.replace("#", "")}.jpg`,
    );
  };

  const baixarZip = async () => {
    const ok = resultados.filter((r) => r.status === "ok" && r.imageUrl);
    if (ok.length === 0) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    ok.forEach((r) =>
      zip.file(`colorswap-${slugify(objetoFinal)}-${r.hex.replace("#", "")}.jpg`, dataUrlToBlob(r.imageUrl!)),
    );
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `colorswap-${slugify(objetoFinal)}.zip`);
  };

  const recomecar = () => {
    setImageBase64("");
    setObjeto("");
    setDescricao("");
    setObjetoManual("");
    setSelecionadas([]);
    setResultados([]);
    setEscolhidas([]);
    setComparar(null);
  };

  const alternarEscolha = (hex: string) => {
    setEscolhidas((atual) =>
      atual.includes(hex) ? atual.filter((h) => h !== hex) : [...atual, hex],
    );
  };

  const mover = (idx: number, dir: -1 | 1) => {
    setEscolhidas((atual) => {
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= atual.length) return atual;
      const copia = [...atual];
      [copia[idx], copia[alvo]] = [copia[alvo], copia[idx]];
      return copia;
    });
  };

  const criarPost = async () => {
    if (escolhidas.length === 0) return;
    setCriando(true);
    try {
      const urls: string[] = [];
      for (const hex of escolhidas) {
        const r = resultados.find((x) => x.hex === hex);
        if (!r?.imageUrl) continue;
        const blob = dataUrlToBlob(r.imageUrl);
        const path = `colorswap-${slugify(objetoFinal)}-${hex.replace("#", "")}-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("videos-instagram")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage.from("videos-instagram").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      const res = await criarRascunho({ data: { urls } });
      if (!res.ok) throw new Error(res.error);
      toast.success("Rascunho criado com as fotos escolhidas.");
      navigate({ to: "/novo", search: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o post.");
    } finally {
      setCriando(false);
    }
  };

  const prontos = useMemo(() => resultados.filter((r) => r.status === "ok"), [resultados]);
  const concluidos = resultados.filter((r) => r.status === "ok" || r.status === "erro").length;

  const swatch = (hex: string, comVariacoes = true) => {
    const ativo = selecionadas.includes(hex);
    return (
      <div key={hex} className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => alternarCor(hex)}
          title={hex}
          aria-label={`Cor ${hex}`}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full border transition",
            ativo ? "border-foreground ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border",
          )}
          style={{ backgroundColor: hex }}
        >
          {ativo && <Check className="h-4 w-4 text-white mix-blend-difference" />}
        </button>
        {comVariacoes && ativo && (
          <button
            type="button"
            onClick={() => setExpandida((e) => (e === hex ? null : hex))}
            className="text-[10px] font-medium text-muted-foreground underline"
          >
            variações
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <DesktopPageHeader
        title="Fotos com IA"
        subtitle="Troque a cor do produto e crie o post direto do resultado"
      />

      <div className="flex flex-col gap-6 pb-40">
        {/* 1. Upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" /> Foto do produto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!imageBase64 ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) void receberArquivo(f);
                }}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition hover:border-primary hover:bg-muted/40"
              >
                <Sparkles className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-semibold">Arraste a foto ou clique para escolher</span>
                <span className="text-xs text-muted-foreground">JPG, PNG ou WEBP · até 10 MB</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-border">
                  <img
                    ref={imgRef}
                    src={imageBase64}
                    alt="Foto enviada"
                    onClick={capturarDaFoto}
                    className={cn("w-full object-contain", conta && "cursor-crosshair")}
                  />
                </div>
                {conta && (
                  <p className="text-xs font-medium text-primary">
                    Modo conta-gotas: clique na foto para capturar a cor.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                    Trocar foto
                  </Button>
                  <Button variant="ghost" size="sm" onClick={recomecar}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Recomeçar
                  </Button>
                </div>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void receberArquivo(f);
                e.target.value = "";
              }}
            />
          </CardContent>
        </Card>

        {/* 2. Objeto identificado */}
        {imageBase64 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Objeto identificado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {identificando ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="text-sm">{objetoFinal || "—"}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setCorrigindo((c) => !c)}>
                      Não é isso
                    </Button>
                  </div>
                  {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
                  {corrigindo && (
                    <div className="space-y-1.5">
                      <Label htmlFor="objeto-manual">Qual é o objeto?</Label>
                      <Input
                        id="objeto-manual"
                        value={objetoManual}
                        onChange={(e) => setObjetoManual(e.target.value)}
                        placeholder="ex.: tênis, camiseta, sofá"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3. Paleta */}
        {imageBase64 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {FAMILIAS.map((fam) => (
                <div key={fam.nome} className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {fam.nome}
                  </p>
                  <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 lg:grid-cols-12">
                    {fam.cores.map((c) => swatch(c))}
                  </div>
                  {fam.cores.includes(expandida ?? "") && (
                    <div className="rounded-lg bg-muted/60 p-3">
                      <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
                        Variações de {expandida}
                      </p>
                      <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 lg:grid-cols-12">
                        {variacoesDe(expandida!).map((c) => swatch(c, false))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {custom.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Minhas cores
                  </p>
                  <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 lg:grid-cols-12">
                    {custom.map((c) => (
                      <div key={c} className="relative">
                        {swatch(c, false)}
                        <button
                          type="button"
                          aria-label={`Remover ${c}`}
                          onClick={() => salvarCustom(custom.filter((x) => x !== c))}
                          className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 text-muted-foreground shadow hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={usarContaGotas}>
                  <Pipette className="mr-1 h-3.5 w-3.5" /> Conta-gotas
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-3">
                    <input
                      type="color"
                      value={novaCor}
                      onChange={(e) => {
                        setNovaCor(e.target.value);
                        setNovoHex(e.target.value.toUpperCase());
                      }}
                      className="h-10 w-full cursor-pointer rounded-md border border-border bg-transparent"
                      aria-label="Escolher cor"
                    />
                    <Input
                      value={novoHex}
                      onChange={(e) => setNovoHex(e.target.value)}
                      placeholder="#1E62F0"
                    />
                    <Button size="sm" className="w-full" onClick={adicionarCustom}>
                      Adicionar cor
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="font-semibold">{selecionadas.length} cores selecionadas</p>
                <p className="text-xs text-muted-foreground">
                  {selecionadas.length} imagens serão geradas — 1 crédito de IA por imagem.
                </p>
              </div>

              <Button
                className="w-full"
                disabled={!imageBase64 || selecionadas.length === 0 || gerando}
                onClick={gerar}
              >
                {gerando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando {concluidos + 1} de{" "}
                    {resultados.length}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Gerar {selecionadas.length} variações
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 4. Resultados */}
        {resultados.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resultados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {gerando && (
                <div className="space-y-1">
                  <Progress value={(concluidos / resultados.length) * 100} />
                  <p className="text-xs text-muted-foreground">
                    Gerando {Math.min(concluidos + 1, resultados.length)} de {resultados.length}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resultados.map((r) => {
                  const escolhido = escolhidas.includes(r.hex);
                  return (
                    <div
                      key={r.hex}
                      className={cn(
                        "overflow-hidden rounded-xl border bg-card transition",
                        escolhido ? "border-primary ring-2 ring-primary" : "border-border",
                      )}
                    >
                      <div className="relative aspect-square bg-muted">
                        {r.status === "ok" && r.imageUrl ? (
                          <>
                            <img
                              src={r.imageUrl}
                              alt={`Resultado ${r.hex}`}
                              onClick={() => alternarEscolha(r.hex)}
                              className="h-full w-full cursor-pointer object-cover"
                            />
                            <button
                              type="button"
                              aria-label={escolhido ? "Remover seleção" : "Selecionar foto"}
                              onClick={() => alternarEscolha(r.hex)}
                              className={cn(
                                "absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border shadow",
                                escolhido
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background/90 text-muted-foreground",
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setComparar(r)}
                              className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-1 text-[11px] font-medium shadow"
                            >
                              Comparar
                            </button>
                          </>
                        ) : r.status === "erro" ? (
                          <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                            <p className="text-xs text-destructive">{r.erro}</p>
                            <Button size="sm" variant="outline" onClick={() => void gerarUma(r.hex)}>
                              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Tentar novamente
                            </Button>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            {r.status === "gerando" ? (
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : (
                              <span className="text-xs text-muted-foreground">Na fila</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: r.hex }}
                          />
                          <span className="truncate text-xs font-medium">{r.hex}</span>
                        </div>
                        {r.status === "ok" && (
                          <Button size="icon" variant="ghost" aria-label="Baixar" onClick={() => baixar(r)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {prontos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void baixarZip()}>
                    <Download className="mr-1 h-3.5 w-3.5" /> Baixar todas (ZIP)
                  </Button>
                  <Button variant="ghost" size="sm" onClick={recomecar}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Recomeçar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ordenação do carrossel */}
        {escolhidas.length >= 2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ordem do carrossel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {escolhidas.map((hex, idx) => {
                const r = resultados.find((x) => x.hex === hex);
                return (
                  <div key={hex} className="flex items-center gap-3 rounded-lg border border-border p-2">
                    <img
                      src={r?.imageUrl}
                      alt={`Miniatura ${hex}`}
                      className="h-14 w-14 shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{hex}</p>
                      {idx === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Capa (aparece primeiro no Instagram)
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Mover para cima"
                        disabled={idx === 0}
                        onClick={() => mover(idx, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Mover para baixo"
                        disabled={idx === escolhidas.length - 1}
                        onClick={() => mover(idx, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Barra fixa de seleção */}
      {escolhidas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:pb-3">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">{escolhidas.length} fotos selecionadas</p>
            <Button disabled={criando} onClick={() => void criarPost()}>
              {criando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando…
                </>
              ) : escolhidas.length === 1 ? (
                "Usar esta foto no post"
              ) : (
                `Criar carrossel com ${escolhidas.length} fotos`
              )}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!comparar} onOpenChange={(o) => !o && setComparar(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Original x {comparar?.hex}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <img src={imageBase64} alt="Original" className="w-full rounded-lg object-contain" />
            {comparar?.imageUrl && (
              <img src={comparar.imageUrl} alt="Resultado" className="w-full rounded-lg object-contain" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
