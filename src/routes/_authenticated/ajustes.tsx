import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Facebook,
  Copy,
  Webhook,
  Zap,
  Loader2,
  RefreshCw,
  Play,
  Activity,
  Check,
  X,
  PartyPopper,
  LogOut,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { testarConexao, renovarToken, executarMotorAgora, recuperarPermalinks } from "@/lib/publicador.functions";
import {
  obterWebhookInfo,
  salvarPageId,
  configurarWebhookMeta,
  verificarStatusWebhook,
  iniciarConexaoMeta,
  obterEstadoMeta,
  escolherPaginaMeta,
} from "@/lib/quitamany.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsDesktop } from "@/hooks/use-desktop";
import { DesktopPageHeader } from "@/components/desktop-shell";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes · QuitaMany" }] }),
  component: AjustesPage,
});

function AjustesPage() {
  const { data: role } = useMyRole();
  const isDesktop = useIsDesktop();
  const isAdmin = role === "admin";
  const [tab, setTab] = useState<string>(isAdmin ? "conexao" : "conta");

  const conteudo = (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex w-full flex-wrap">
          {isAdmin && <TabsTrigger value="conexao">Conexão</TabsTrigger>}
          {isAdmin && <TabsTrigger value="webhook">Webhook</TabsTrigger>}
          {isAdmin && <TabsTrigger value="motor">Motor</TabsTrigger>}
          {isAdmin && <TabsTrigger value="equipe">Equipe</TabsTrigger>}
          <TabsTrigger value="conta">Conta</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="conexao" className="space-y-4">
            <ConexaoFacebookSection />
            <ConexaoManualFallback />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="webhook">
            <WebhookSection />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="motor">
            <MotorPublicacao />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="equipe">
            <Equipe />
          </TabsContent>
        )}
        <TabsContent value="conta">
          <ContaSection />
        </TabsContent>
      </Tabs>
    </div>
  );

  if (isDesktop) {
    return (
      <>
        <DesktopPageHeader title="Ajustes" subtitle="Conexão, webhook, motor e equipe." />
        {conteudo}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Conexão, webhook e equipe.</p>
      </header>
      {conteudo}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    CONTA                                   */
/* -------------------------------------------------------------------------- */

function ContaSection() {
  const { data: role } = useMyRole();
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then((r) => setEmail(r.data.user?.email ?? ""));
  }, []);

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sua conta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border p-3 text-sm">
          <p className="text-muted-foreground text-xs">E-mail</p>
          <p className="font-medium">{email || "—"}</p>
        </div>
        <div className="rounded-xl border p-3 text-sm">
          <p className="text-muted-foreground text-xs">Papel</p>
          <p className="font-medium capitalize">{role || "—"}</p>
        </div>
        <Button variant="outline" className="w-full" onClick={sair}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                             CONEXÃO — FACEBOOK OAUTH                        */
/* -------------------------------------------------------------------------- */

function ConexaoFacebookSection() {
  const iniciar = useServerFn(iniciarConexaoMeta);
  const obterEstado = useServerFn(obterEstadoMeta);
  const escolher = useServerFn(escolherPaginaMeta);
  const obter = useServerFn(obterWebhookInfo);

  const [origem, setOrigem] = useState("");
  const [conectando, setConectando] = useState(false);
  const [estado, setEstado] = useState<null | { status: "aguardando" | "escolher_pagina" | "conectado" | "erro"; erro: string | null; paginas: any }>(null);
  const [contaAtual, setContaAtual] = useState<{ username?: string; page_id?: string; ig_user_id?: string }>({});
  const [escolhendo, setEscolhendo] = useState<string | null>(null);

  const redirectUri = useMemo(() => (origem ? `${origem}/api/public/meta-callback` : ""), [origem]);

  useEffect(() => {
    setOrigem(window.location.origin);
    obter({}).then((r: any) => {
      if (r?.ok) setContaAtual({ username: r.conta_username, page_id: r.page_id, ig_user_id: r.ig_user_id });
    });
  }, [obter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const st = params.get("meta_state");
    const err = params.get("meta_erro");
    if (err) {
      toast.error(err);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!st) return;
    let cancelled = false;
    const poll = async () => {
      const r: any = await obterEstado({ data: { state: st } });
      if (cancelled) return;
      if (!r?.ok) {
        toast.error(r?.error || "Falha ao consultar estado");
        return;
      }
      setEstado({ status: r.status, erro: r.erro, paginas: r.paginas });
      if (r.status === "aguardando") setTimeout(poll, 1500);
      else if (r.status === "conectado") {
        obter({}).then((r2: any) => {
          if (r2?.ok) setContaAtual({ username: r2.conta_username, page_id: r2.page_id, ig_user_id: r2.ig_user_id });
        });
        toast.success("Conectado com sucesso!");
      } else if (r.status === "erro") toast.error(r.erro || "Falha na conexão");
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [obterEstado, obter]);

  const copiar = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  };

  const handleConectar = async () => {
    setConectando(true);
    try {
      const r: any = await iniciar({ data: { origin: window.location.origin } });
      if (!r?.ok) {
        toast.error(r?.error || "Falha ao iniciar conexão");
        return;
      }
      window.location.href = r.oauth_url;
    } finally {
      setConectando(false);
    }
  };

  const handleEscolherPagina = async (state: string, page_id: string) => {
    setEscolhendo(page_id);
    try {
      const r: any = await escolher({ data: { state, page_id } });
      if (r?.ok) {
        toast.success(`Conectado como @${r.username}`);
        setEstado({ status: "conectado", erro: null, paginas: null });
        obter({}).then((r2: any) => {
          if (r2?.ok) setContaAtual({ username: r2.conta_username, page_id: r2.page_id, ig_user_id: r2.ig_user_id });
        });
      } else toast.error(r?.error || "Falha ao finalizar");
    } finally {
      setEscolhendo(null);
    }
  };

  const stateParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("meta_state") : null;
  const jaConectado = !!contaAtual.username && (!estado || estado.status === "conectado");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Facebook className="h-5 w-5 text-primary" /> Conexão com o Instagram
        </CardTitle>
        <CardDescription>Login com Facebook para conectar o Instagram e configurar o webhook em um clique.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {jaConectado ? (
          <div className="flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
            <div className="rounded-full bg-green-500/20 p-2">
              <PartyPopper className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">Conectado como @{contaAtual.username}</p>
              <p className="text-xs text-muted-foreground truncate">Página: {contaAtual.page_id} · IG ID: {contaAtual.ig_user_id}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleConectar} disabled={conectando}>
              {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reconectar"}
            </Button>
          </div>
        ) : (
          <Button size="lg" className="w-full h-14 text-base bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleConectar} disabled={conectando || (estado?.status === "aguardando" && !!stateParam)}>
            {conectando ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Facebook className="mr-2 h-5 w-5" />}
            Conectar com Facebook
          </Button>
        )}

        {estado?.status === "escolher_pagina" && Array.isArray(estado.paginas) && (
          <div className="space-y-2 rounded-2xl border p-4">
            <p className="text-sm font-semibold">Escolha a Página vinculada ao seu Instagram</p>
            {estado.paginas.map((p: any) => (
              <button
                key={p.id}
                onClick={() => stateParam && handleEscolherPagina(stateParam, p.id)}
                disabled={escolhendo === p.id}
                className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:bg-accent disabled:opacity-50"
              >
                <div>
                  <p className="font-medium">{p.name ?? p.id}</p>
                  <p className="text-xs text-muted-foreground">{p.id}</p>
                </div>
                {escolhendo === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-sm font-medium text-primary">Escolher</span>}
              </button>
            ))}
          </div>
        )}

        {estado?.status === "erro" && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold text-destructive">Não deu certo</p>
            <p className="mt-1 text-muted-foreground">{estado.erro}</p>
          </div>
        )}

        <div className="space-y-2 rounded-2xl border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passo único no painel da Meta</p>
          <p className="text-sm">
            Cadastre esta URL em <b>Login do Facebook para Empresas → URIs de redirecionamento válidos</b>:
          </p>
          <div className="flex gap-2">
            <Input readOnly value={redirectUri} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={() => copiar(redirectUri, "URL")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                     CONEXÃO — MANUAL (token colado)                        */
/* -------------------------------------------------------------------------- */

function ConexaoManualFallback() {
  const qc = useQueryClient();
  const testar = useServerFn(testarConexao);
  const renovar = useServerFn(renovarToken);
  const [igUserId, setIgUserId] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [aberto, setAberto] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ["ig-config"],
    queryFn: async () => {
      const { data } = await supabase.from("ig_config").select("*").limit(1).maybeSingle();
      return data as any;
    },
  });

  const diasDesdeToken = cfg
    ? Math.floor((Date.now() - new Date(cfg.token_gerado_em).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const diasRestantes = 60 - diasDesdeToken;
  const percent = Math.min(100, (diasDesdeToken / 60) * 100);
  const tokenColor = diasDesdeToken >= 55 ? "bg-red-500" : diasDesdeToken >= 50 ? "bg-yellow-500" : "bg-green-500";

  const handleTestar = async () => {
    if (!igUserId || !token) return toast.error("Preencha os dois campos");
    setTesting(true);
    const res: any = await testar({ data: { ig_user_id: igUserId, access_token: token } });
    setTesting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Conectado como @${res.username}`);
    setToken("");
    qc.invalidateQueries({ queryKey: ["ig-config"] });
  };

  const handleRenovar = async () => {
    const res: any = await renovar({});
    if (!res.ok) return toast.error(res.error);
    toast.success("Token renovado!");
    qc.invalidateQueries({ queryKey: ["ig-config"] });
  };

  return (
    <Card>
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between p-4 text-sm font-semibold">
        <span>Conexão manual por token (avançado)</span>
        <span className="text-xs text-muted-foreground">{aberto ? "Fechar" : "Abrir"}</span>
      </button>
      {aberto && (
        <CardContent className="space-y-4 border-t pt-4">
          {cfg && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Conectado como <span className="text-green-700 dark:text-green-400">@{cfg.conta_username}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Token válido até {format(new Date(new Date(cfg.token_gerado_em).getTime() + 60 * 24 * 3600 * 1000), "dd/MM/yyyy", { locale: ptBR })} · {diasRestantes} dias restantes
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${tokenColor}`} style={{ width: `${percent}%` }} />
              </div>
              <Button size="sm" variant="outline" onClick={handleRenovar} className="mt-3">
                <RefreshCw className="mr-2 h-3 w-3" /> Renovar token
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ig-user-id">IG User ID</Label>
            <Input id="ig-user-id" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} placeholder="17841400000000000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token</Label>
            <div className="relative">
              <Input id="access-token" type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAG..." />
              <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleTestar} disabled={testing} className="w-full">
            {testing ? "Testando…" : "Testar conexão e salvar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Use o{" "}
            <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-primary underline">
              Graph API Explorer <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            para gerar um token com <code>instagram_content_publish</code>.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 WEBHOOK                                    */
/* -------------------------------------------------------------------------- */

function WebhookSection() {
  const obter = useServerFn(obterWebhookInfo);
  const salvarPage = useServerFn(salvarPageId);
  const configurar = useServerFn(configurarWebhookMeta);
  const verificar = useServerFn(verificarStatusWebhook);

  const [origem, setOrigem] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageIdSalvo, setPageIdSalvo] = useState("");
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

  const { data: ultimosErros } = useQuery({
    queryKey: ["qm-ultimos-erros"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("eventos_webhook")
        .select("id, tipo, criado_em, erro")
        .not("erro", "is", null)
        .order("criado_em", { ascending: false })
        .limit(10);
      return (data ?? []) as Array<{ id: string; tipo: string; criado_em: string; erro: string }>;
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
      } else toast.error(r?.error || "Falha ao salvar");
    } finally {
      setSalvandoPage(false);
    }
  };

  const handleConfigurar = async () => {
    setConfigurando(true);
    setResultado(null);
    try {
      const r: any = await configurar({ data: { callback_url: webhookUrl } });
      if (!r?.ok) return toast.error(r?.error || "Falha na configuração");
      setResultado({ etapa1: r.etapa1, etapa2: r.etapa2 });
      if (r.etapa1?.ok && r.etapa2?.ok) toast.success("Webhook configurado!");
      else toast.warning("Configuração parcial");
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
      if (!r?.ok) return toast.error(r?.error || "Falha ao verificar");
      setStatus(r);
    } finally {
      setVerificando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" /> Webhook do Instagram
        </CardTitle>
        <CardDescription>Receba comentários e DMs em tempo real.</CardDescription>
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
            <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="ID da página" className="font-mono text-xs" />
            <Button variant="outline" onClick={handleSalvarPageId} disabled={salvandoPage || !pageId.trim() || pageId.trim() === pageIdSalvo}>
              {salvandoPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-2">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">Configurar automaticamente na Meta</p>
              <p className="text-xs text-muted-foreground">Registra o webhook e inscreve a Página.</p>
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
              <ResultLine ok={!!resultado.etapa2?.ok} label="Inscrever página" msg={resultado.etapa2?.msg} />
            </div>
          )}
          {status && (
            <pre className="max-h-40 overflow-auto rounded-xl bg-background/60 p-3 text-[11px]">
              {JSON.stringify(status, null, 2)}
            </pre>
          )}
        </div>

        <div className="rounded-xl border p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Último evento recebido</p>
          <p className="mt-0.5 font-medium">
            {ultimoEvento
              ? format(new Date(ultimoEvento.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
              : "Nenhum evento ainda"}
          </p>
        </div>

        <div className="rounded-xl border p-3">
          <p className="text-xs font-medium text-muted-foreground">Últimos erros</p>
          {!ultimosErros || ultimosErros.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum erro registrado.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {ultimosErros.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      {e.tipo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(e.criado_em), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground break-words">{e.erro}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

function ResultLine({ ok, label, msg }: { ok: boolean; label: string; msg?: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        {msg && <p className="text-xs text-muted-foreground break-words">{msg}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   MOTOR                                    */
/* -------------------------------------------------------------------------- */

function MotorPublicacao() {
  const qc = useQueryClient();
  const executar = useServerFn(executarMotorAgora);
  const recuperar = useServerFn(recuperarPermalinks);
  const [running, setRunning] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: cfg } = useQuery({
    queryKey: ["ig-config-motor"],
    queryFn: async () => {
      const { data } = await supabase.from("ig_config").select("*").limit(1).maybeSingle();
      return data as any;
    },
    refetchInterval: 30_000,
  });

  const ultima = (cfg as any)?.ultima_execucao_motor as string | undefined;
  const minutosAtras = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 60_000) : null;

  const statusCron =
    minutosAtras === null
      ? { label: "Nenhuma execução automática registrada ainda", color: "text-muted-foreground" }
      : minutosAtras <= 6
        ? { label: `Última execução automática há ${minutosAtras} min · cron ativo`, color: "text-green-600 dark:text-green-400" }
        : minutosAtras <= 15
          ? { label: `Última execução automática há ${minutosAtras} min`, color: "text-yellow-600 dark:text-yellow-500" }
          : { label: `Última execução automática há ${minutosAtras} min · verifique o cron`, color: "text-red-600 dark:text-red-400" };

  const handleExecutar = async () => {
    setRunning(true);
    try {
      const res: any = await executar({});
      setLastResult(res);
      if (res?.ok) toast.success(`Motor executado: ${res.a?.processados ?? 0} enviados, ${res.b?.publicados ?? 0} publicados`);
      else toast.error(res?.error || "Falha ao executar motor");
      qc.invalidateQueries({ queryKey: ["ig-config-motor"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro inesperado");
    } finally {
      setRunning(false);
    }
  };

  const handleRecuperar = async () => {
    setRecuperando(true);
    try {
      const res: any = await recuperar({});
      if (res?.ok) {
        toast.success(`${res.atualizados} permalink(s) recuperado(s) · ${res.falhas} falha(s) de ${res.total}`);
        qc.invalidateQueries({ queryKey: ["posts-agendados"] });
      } else {
        toast.error(res?.error || "Falha ao recuperar permalinks");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro inesperado");
    } finally {
      setRecuperando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motor de publicação</CardTitle>
        <CardDescription>Publica automaticamente os posts agendados a cada 5 minutos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <Activity className={`h-4 w-4 ${statusCron.color}`} />
          <span className={`text-sm ${statusCron.color}`}>{statusCron.label}</span>
        </div>
        <Button onClick={handleExecutar} disabled={running} className="w-full">
          <Play className="mr-2 h-4 w-4" /> {running ? "Executando…" : "Executar agora"}
        </Button>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Recuperar links do Instagram</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Busca o permalink dos posts já publicados que ainda não têm o link salvo.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecuperar}
            disabled={recuperando}
            className="mt-2"
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            {recuperando ? "Buscando…" : "Recuperar permalinks"}
          </Button>
        </div>
        {lastResult && (
          <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   EQUIPE                                   */
/* -------------------------------------------------------------------------- */

function Equipe() {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*").order("criado_em", { ascending: false });
      return data || [];
    },
  });

  const alterarPapel = async (userId: string, novoPapel: "admin" | "editor" | "pendente") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: novoPapel });
    if (error) return toast.error(error.message);
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["all-roles"] });
  };

  const convidar = async () => {
    if (!inviteEmail) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    if (error) return toast.error(error.message);
    toast.success("Convite enviado por e-mail");
    setInviteEmail("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipe</CardTitle>
        <CardDescription>Gerencie quem pode agendar e responder.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {roles.length === 0 && <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</p>}
          {roles.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{r.user_id.slice(0, 8)}…</p>
                <p className="text-xs text-muted-foreground">
                  desde {format(new Date(r.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <Badge variant={r.role === "pendente" ? "outline" : "secondary"}>{r.role}</Badge>
              <Select value={r.role} onValueChange={(v) => alterarPapel(r.user_id, v as any)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="invite">Convidar por e-mail</Label>
          <div className="flex gap-2">
            <Input id="invite" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="nome@exemplo.com" />
            <Button onClick={convidar}>Enviar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Enviamos um link mágico. Depois aprove o novo usuário aqui.</p>
        </div>
      </CardContent>
    </Card>
  );
}
