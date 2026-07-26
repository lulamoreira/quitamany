import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, LogOut, Webhook, CheckCircle2, AlertCircle, Zap, ChevronDown, Check, X, Loader2, RefreshCw } from "lucide-react";
import {
  obterWebhookInfo,
  salvarPageId,
  configurarWebhookMeta,
  verificarStatusWebhook,
} from "@/lib/quitamany.functions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quitamany/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes · QuitaMany" }] }),
  component: AjustesPage,
});

function AjustesPage() {
  const { data: role } = useMyRole();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Conexão do webhook do Instagram.</p>
      </header>

      {role === "admin" && <WebhookSection />}

      <Card>
        <CardContent className="p-4">
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function WebhookSection() {
  const obter = useServerFn(obterWebhookInfo);
  const salvarPage = useServerFn(salvarPageId);
  const configurar = useServerFn(configurarWebhookMeta);
  const verificar = useServerFn(verificarStatusWebhook);

  const [origem, setOrigem] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageIdSalvo, setPageIdSalvo] = useState("");
  const [manualAberto, setManualAberto] = useState(false);

  const [configurando, setConfigurando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [salvandoPage, setSalvandoPage] = useState(false);
  const [resultado, setResultado] = useState<{ etapa1?: { ok: boolean; msg: string }; etapa2?: { ok: boolean; msg: string } } | null>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    setOrigem(window.location.origin);
    obter({}).then((r: any) => {
      if (r?.ok) {
        setVerifyToken(r.verify_token || "");
        setPageId(r.page_id || "");
        setPageIdSalvo(r.page_id || "");
      }
    });
  }, [obter]);

  const webhookUrl = `${origem}/api/public/hooks/webhook-instagram`;

  const { data: ultimoEvento } = useQuery({
    queryKey: ["qm-ultimo-evento"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("eventos_webhook")
        .select("criado_em")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { criado_em: string } | null;
    },
    refetchInterval: 30_000,
  });

  const copiar = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  };

  const handleSalvarPageId = async () => {
    setSalvandoPage(true);
    try {
      const r: any = await salvarPage({ data: { page_id: pageId.trim() } });
      if (r?.ok) {
        setPageIdSalvo(pageId.trim());
        toast.success("Page ID salvo");
      } else {
        toast.error(r?.error || "Falha ao salvar");
      }
    } finally {
      setSalvandoPage(false);
    }
  };

  const handleConfigurar = async () => {
    setConfigurando(true);
    setResultado(null);
    try {
      const r: any = await configurar({ data: { callback_url: webhookUrl } });
      if (!r?.ok) {
        toast.error(r?.error || "Falha na configuração");
        return;
      }
      setResultado({ etapa1: r.etapa1, etapa2: r.etapa2 });
      if (r.etapa1?.ok && r.etapa2?.ok) toast.success("Webhook configurado na Meta!");
      else toast.warning("Configuração parcial — veja o resultado abaixo");
    } catch (e: any) {
      toast.error(e?.message || "Erro inesperado");
    } finally {
      setConfigurando(false);
    }
  };

  const handleVerificar = async () => {
    setVerificando(true);
    try {
      const r: any = await verificar({});
      if (!r?.ok) {
        toast.error(r?.error || "Falha ao verificar");
        return;
      }
      setStatus(r);
    } finally {
      setVerificando(false);
    }
  };

  return (
    <Card className="border-transparent shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" /> Webhook do Instagram
        </CardTitle>
        <CardDescription>Conecte a Meta ao QuitaMany para receber comentários e DMs em tempo real.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Callback URL</label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={() => copiar(webhookUrl, "URL")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Verify Token</label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={verifyToken} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={() => copiar(verifyToken, "Token")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Page ID (Facebook)</label>
          <div className="mt-1 flex gap-2">
            <Input
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="ID numérico da página do Facebook vinculada"
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              onClick={handleSalvarPageId}
              disabled={salvandoPage || !pageId.trim() || pageId.trim() === pageIdSalvo}
            >
              {salvandoPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Encontre em business.facebook.com → sua Página → Sobre → ID da Página.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">Configurar automaticamente na Meta</p>
              <p className="text-xs text-muted-foreground">
                Registra o webhook do app e inscreve a Página. Requer Page ID salvo acima.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleConfigurar} disabled={configurando || !pageIdSalvo} className="flex-1">
              {configurando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Configurar automaticamente
            </Button>
            <Button variant="outline" onClick={handleVerificar} disabled={verificando}>
              {verificando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Verificar status
            </Button>
          </div>

          {resultado && (
            <div className="space-y-2 rounded-xl bg-background/60 p-3 text-sm">
              <ResultLine ok={!!resultado.etapa1?.ok} label="Registrar webhook do app" msg={resultado.etapa1?.msg} />
              <ResultLine ok={!!resultado.etapa2?.ok} label="Inscrever Página no app" msg={resultado.etapa2?.msg} />
            </div>
          )}

          {status && (
            <div className="space-y-2 rounded-xl bg-background/60 p-3 text-xs">
              <p className="font-semibold text-sm">Status atual na Meta</p>
              <div>
                <div className="flex items-center gap-2">
                  {status.app_subscriptions?.ok ? <Check className="h-3.5 w-3.5 text-green-600" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                  <span className="font-medium">App subscriptions</span>
                </div>
                {status.app_subscriptions?.ok ? (
                  status.app_subscriptions.data?.length ? (
                    <ul className="ml-5 mt-1 list-disc text-muted-foreground">
                      {status.app_subscriptions.data.map((s: any, i: number) => (
                        <li key={i}>
                          {s.object} → {(s.fields ?? []).map((f: any) => f.name ?? f).join(", ") || "—"}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ml-5 text-muted-foreground">Nenhuma inscrição encontrada.</p>
                  )
                ) : (
                  <p className="ml-5 text-destructive">{status.app_subscriptions?.error}</p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {status.page_subscribed?.ok ? <Check className="h-3.5 w-3.5 text-green-600" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                  <span className="font-medium">Página inscrita</span>
                </div>
                {status.page_subscribed?.ok ? (
                  status.page_subscribed.data?.length ? (
                    <ul className="ml-5 mt-1 list-disc text-muted-foreground">
                      {status.page_subscribed.data.map((s: any, i: number) => (
                        <li key={i}>
                          {s.name ?? s.id} — {(s.subscribed_fields ?? []).join(", ") || "—"}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ml-5 text-muted-foreground">Nenhum app inscrito na página.</p>
                  )
                ) : (
                  <p className="ml-5 text-destructive">{status.page_subscribed?.error}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border">
          <button
            className="flex w-full items-center justify-between p-3 text-sm font-medium"
            onClick={() => setManualAberto((v) => !v)}
          >
            <span>Configurar manualmente</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", manualAberto && "rotate-180")} />
          </button>
          {manualAberto && (
            <div className="border-t p-4 text-sm">
              <ol className="space-y-2 text-muted-foreground">
                <li><span className="font-semibold text-foreground">1.</span> Acesse <a className="text-primary underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> e abra seu app.</li>
                <li><span className="font-semibold text-foreground">2.</span> No menu lateral, vá em <b>Webhooks</b>.</li>
                <li><span className="font-semibold text-foreground">3.</span> No dropdown do topo, selecione <b>Instagram</b>.</li>
                <li><span className="font-semibold text-foreground">4.</span> Clique <b>Callback URL</b> e cole os dois valores acima (URL e Verify Token). Salve.</li>
                <li><span className="font-semibold text-foreground">5.</span> Assine os campos <b>messages</b> e <b>comments</b>.</li>
              </ol>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-2xl border p-3 text-sm">
          {ultimoEvento ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Último evento recebido {formatDistanceToNow(new Date(ultimoEvento.criado_em), { locale: ptBR, addSuffix: true })}</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-muted-foreground">Nenhum evento recebido ainda. Faça um comentário de teste no @quitanda3d para conferir.</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultLine({ ok, label, msg }: { ok: boolean; label: string; msg?: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {msg && <p className={cn("text-xs", ok ? "text-muted-foreground" : "text-destructive")}>{msg}</p>}
      </div>
    </div>
  );
}
