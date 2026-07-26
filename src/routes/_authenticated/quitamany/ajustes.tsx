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
import { Copy, LogOut, Webhook, CheckCircle2, AlertCircle } from "lucide-react";
import { obterWebhookInfo } from "@/lib/quitamany.functions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [origem, setOrigem] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  useEffect(() => {
    setOrigem(window.location.origin);
    obter({}).then((r: any) => { if (r?.ok) setVerifyToken(r.verify_token || ""); });
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

        <div className="rounded-2xl bg-accent/50 p-4 text-sm">
          <p className="font-semibold">Como conectar (5 min):</p>
          <ol className="mt-2 space-y-2 text-muted-foreground">
            <li><span className="font-semibold text-foreground">1.</span> Acesse <a className="text-primary underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> e abra seu app.</li>
            <li><span className="font-semibold text-foreground">2.</span> No menu lateral, vá em <b>Webhooks</b>.</li>
            <li><span className="font-semibold text-foreground">3.</span> No dropdown do topo, selecione <b>Instagram</b>.</li>
            <li><span className="font-semibold text-foreground">4.</span> Clique <b>Callback URL</b> e cole os dois valores acima (URL e Verify Token). Salve.</li>
            <li><span className="font-semibold text-foreground">5.</span> Assine os campos <b>messages</b> e <b>comments</b>.</li>
          </ol>
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
