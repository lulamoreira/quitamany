import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, LogOut, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";
import { testarConexao, renovarToken } from "@/lib/publicador.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/publicador/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes · Publicador" }] }),
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
      <header>
        <h1 className="text-2xl font-bold">Ajustes</h1>
      </header>

      {role === "admin" && (
        <>
          <ConexaoMeta />
          <Equipe />
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ConexaoMeta() {
  const qc = useQueryClient();
  const testar = useServerFn(testarConexao);
  const renovar = useServerFn(renovarToken);
  const [igUserId, setIgUserId] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ["ig-config"],
    queryFn: async () => {
      const { data } = await supabase.from("ig_config").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const diasDesdeToken = cfg
    ? Math.floor((Date.now() - new Date(cfg.token_gerado_em).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const diasRestantes = 60 - diasDesdeToken;
  const percent = Math.min(100, (diasDesdeToken / 60) * 100);
  const tokenColor =
    diasDesdeToken >= 55 ? "bg-red-500" : diasDesdeToken >= 50 ? "bg-yellow-500" : "bg-green-500";

  const handleTestar = async () => {
    if (!igUserId || !token) return toast.error("Preencha os dois campos");
    setTesting(true);
    const res = await testar({ data: { ig_user_id: igUserId, access_token: token } });
    setTesting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Conectado como @${res.username}`);
    setToken("");
    qc.invalidateQueries({ queryKey: ["ig-config"] });
  };

  const handleRenovar = async () => {
    const res = await renovar({});
    if (!res.ok) return toast.error(res.error);
    toast.success("Token renovado com sucesso!");
    qc.invalidateQueries({ queryKey: ["ig-config"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexão com o Instagram</CardTitle>
        <CardDescription>
          Conecte a conta @quitanda3d via API oficial da Meta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cfg && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Conectado como <span className="text-green-700 dark:text-green-400">@{cfg.conta_username}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Token válido até {format(new Date(new Date(cfg.token_gerado_em).getTime() + 60 * 24 * 3600 * 1000), "dd/MM/yyyy", { locale: ptBR })}
              {" · "}{diasRestantes} dias restantes
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full ${tokenColor}`} style={{ width: `${percent}%` }} />
            </div>
            <Button size="sm" variant="outline" onClick={handleRenovar} className="mt-3">
              <RefreshCw className="mr-2 h-3 w-3" />
              Renovar token
            </Button>
          </div>
        )}

        <div className="space-y-3 rounded-lg border p-3">
          <h4 className="text-sm font-semibold">Assistente de conexão</h4>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li>
              <strong>1.</strong> Crie um app em{" "}
              <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                developers.facebook.com <ExternalLink className="inline h-3 w-3" />
              </a>{" "}
              e adicione o produto "Instagram Graph API".
            </li>
            <li>
              <strong>2.</strong> No{" "}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Graph API Explorer <ExternalLink className="inline h-3 w-3" />
              </a>
              , gere um token de longa duração com permissões{" "}
              <code>instagram_content_publish</code> e <code>pages_read_engagement</code>.
            </li>
            <li>
              <strong>3.</strong> Obtenha o IG User ID da sua conta business e cole abaixo junto
              com o token.
            </li>
          </ol>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ig-user-id">IG User ID</Label>
          <Input
            id="ig-user-id"
            value={igUserId}
            onChange={(e) => setIgUserId(e.target.value)}
            placeholder="17841400000000000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="access-token">Access Token</Label>
          <div className="relative">
            <Input
              id="access-token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAAG..."
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button onClick={handleTestar} disabled={testing} className="w-full">
          {testing ? "Testando…" : "Testar conexão e salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Equipe() {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("*")
        .order("criado_em", { ascending: false });
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
      options: { emailRedirectTo: window.location.origin + "/publicador" },
    });
    if (error) return toast.error(error.message);
    toast.success("Convite enviado por e-mail");
    setInviteEmail("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipe</CardTitle>
        <CardDescription>Gerencie quem pode agendar posts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {roles.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
          )}
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{r.user_id.slice(0, 8)}…</p>
                <p className="text-xs text-muted-foreground">
                  desde {format(new Date(r.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <Badge variant={r.role === "pendente" ? "outline" : "secondary"}>{r.role}</Badge>
              <Select
                value={r.role}
                onValueChange={(v) => alterarPapel(r.user_id, v as any)}
              >
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
            <Input
              id="invite"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="nome@exemplo.com"
            />
            <Button onClick={convidar}>Enviar</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enviaremos um link mágico. Depois do primeiro login, aprove o novo usuário aqui.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
