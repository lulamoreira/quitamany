import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, Copy, RotateCcw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { supabase } from "@/integrations/supabase/client";
import { executarMotorAgora } from "@/lib/publicador.functions";
import { cn } from "@/lib/utils";

/** Post com falha de publicação (subset das colunas usadas aqui). */
export interface PostComErro {
  id: string;
  titulo: string | null;
  legenda: string | null;
  erro_msg: string | null;
  video_url: string | null;
  container_id: string | null;
  agendado_para: string | null;
  updated_at: string | null;
  criado_em: string;
}

interface ErrosPublicacaoProps {
  posts: PostComErro[];
  onAtualizar: () => void;
  className?: string;
}

/**
 * Traduz mensagens cruas da Graph API / Edge Function em uma dica acionável.
 * Heurística por palavra-chave: nunca substitui a mensagem original, apenas
 * a complementa.
 */
function diagnosticar(msg: string | null): string | null {
  if (!msg) return null;
  const m = msg.toLowerCase();
  if (m.includes("token") || m.includes("oauth") || m.includes("session has expired"))
    return "O token da conta parece expirado ou inválido. Reconecte a conta em Ajustes → Conexão.";
  if (m.includes("permission") || m.includes("(#200)") || m.includes("scope"))
    return "Faltam permissões na conta conectada. Refaça a conexão com o Facebook aceitando todas as permissões.";
  if (m.includes("media") && (m.includes("format") || m.includes("aspect") || m.includes("duration")))
    return "O Instagram recusou o vídeo (formato, proporção ou duração). Gere o vídeo novamente em MP4 9:16 até 90s.";
  if (m.includes("download") || m.includes("fetch") || m.includes("url"))
    return "O Instagram não conseguiu baixar o vídeo. Verifique se o arquivo continua disponível e tente reenviar.";
  if (m.includes("rate") || m.includes("limit") || m.includes("(#4)"))
    return "Limite de requisições da Meta atingido. Aguarde alguns minutos antes de reenviar.";
  if (m.includes("timeout") || m.includes("expired") || m.includes("in_progress"))
    return "O processamento na Meta demorou demais. Reenviar normalmente resolve.";
  return null;
}

export function ErrosPublicacao({ posts, onAtualizar, className }: ErrosPublicacaoProps) {
  const [aberto, setAberto] = useState(true);
  const [confirmar, setConfirmar] = useState<PostComErro | null>(null);
  const [enviando, setEnviando] = useState(false);
  const executarMotorFn = useServerFn(executarMotorAgora);

  if (posts.length === 0) return null;

  const reenviar = async (post: PostComErro) => {
    setEnviando(true);
    try {
      // Limpa o estado de falha para que o motor reprocesse do zero.
      const { error } = await supabase
        .from("posts_agendados")
        .update({
          status: "agendado",
          erro_msg: null,
          container_id: null,
          agendado_para: new Date().toISOString(),
        })
        .eq("id", post.id);
      if (error) throw new Error(error.message);

      // Tentar acionar o motor imediatamente; se o usuário não for admin,
      // o post continua na fila do cron (a cada 5 minutos).
      try {
        await executarMotorFn({});
        toast.success("Reenvio iniciado. Acompanhe o status em instantes.");
      } catch {
        toast.success("Post recolocado na fila. Sai na próxima execução do motor.");
      }
      setConfirmar(null);
      onAtualizar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reenviar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Card className={cn("border-destructive/30", className)}>
        <Collapsible open={aberto} onOpenChange={setAberto}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex-row items-center justify-between gap-2 space-y-0 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Erros de publicação
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {posts.length}
                </span>
              </CardTitle>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", aberto && "rotate-180")}
              />
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0">
              {posts.map((p) => {
                const dica = diagnosticar(p.erro_msg);
                const quando = p.updated_at ?? p.criado_em;
                return (
                  <div key={p.id} className="rounded-lg border bg-muted/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p.titulo || p.legenda?.slice(0, 60) || "Sem título"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Falhou em{" "}
                          {format(new Date(quando), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      {p.erro_msg || "Sem mensagem retornada pela Meta."}
                    </pre>

                    {dica && <p className="mt-2 text-xs text-muted-foreground">💡 {dica}</p>}

                    {p.container_id && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Container Meta: <code>{p.container_id}</code>
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(
                              `Post: ${p.titulo ?? p.id}\nQuando: ${quando}\nErro: ${p.erro_msg ?? "-"}\nContainer: ${p.container_id ?? "-"}`,
                            )
                            .then(() => toast.success("Detalhes copiados"))
                            .catch(() => toast.error("Não foi possível copiar"));
                        }}
                      >
                        <Copy className="mr-2 h-3 w-3" />
                        Copiar detalhes
                      </Button>
                      <Button size="sm" onClick={() => setConfirmar(p)}>
                        <RotateCcw className="mr-2 h-3 w-3" />
                        Reenviar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar para o Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              O post “{confirmar?.titulo || "sem título"}” volta para a fila e será publicado assim
              que o motor rodar. Publicação é irreversível — confira legenda e vídeo antes.
              {!confirmar?.video_url && " Atenção: este post não tem vídeo anexado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={enviando || !confirmar?.video_url}
              onClick={(e) => {
                e.preventDefault();
                if (confirmar) void reenviar(confirmar);
              }}
            >
              {enviando && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Reenviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
