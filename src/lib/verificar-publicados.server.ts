import { GRAPH } from "@/lib/graph";

/**
 * Verifica se os posts marcados como publicados ainda existem no Instagram.
 *
 * Filosofia defensiva: só marcamos "removido" quando a Meta afirma
 * explicitamente que o objeto não existe. Qualquer outra falha (rede, token,
 * rate limit) é tratada como inconclusiva — nesses casos NÃO tocamos em
 * `verificado_em`, para que o post seja reavaliado na próxima rodada.
 */

/** Quantos posts inspecionamos por execução (evita estourar rate limit). */
const LOTE = 25;

export interface ResumoVerificacao {
  verificados: number;
  removidos: number;
  /** Quantos posts tiveram curtidas/comentários/compartilhamentos atualizados. */
  metricasAtualizadas: number;
  interrompidoPorToken: boolean;
  erros: string[];
}

/** Métricas de desempenho de uma publicação. `null` = indisponível na Meta. */
interface MetricasMidia {
  curtidas: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  reposts: number | null;
}

function numeroOuNulo(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Lê métricas de insights (compartilhamentos/reposts). Insights só existem
 * para alguns tipos de mídia e podem falhar por permissão — qualquer falha é
 * tratada como "indisponível", nunca como erro do fluxo de verificação.
 */
async function lerInsights(
  mediaId: string,
  token: string,
): Promise<{ compartilhamentos: number | null; reposts: number | null }> {
  const buscar = async (metric: string): Promise<number | null> => {
    try {
      const resp = await fetch(
        `${GRAPH}/${mediaId}/insights?metric=${metric}&access_token=${encodeURIComponent(token)}`,
      );
      const body = await resp.json().catch(() => null);
      const valor = body?.data?.[0]?.values?.[0]?.value;
      return numeroOuNulo(valor);
    } catch {
      return null;
    }
  };

  // Chamadas separadas: uma métrica inválida para o tipo de mídia derruba
  // a requisição inteira quando pedidas juntas.
  const [compartilhamentos, reposts] = await Promise.all([
    buscar("shares"),
    buscar("reposts"),
  ]);
  return { compartilhamentos, reposts };
}

/** Códigos que indicam problema transitório/credencial, nunca "post apagado". */
const CODIGOS_RATE_LIMIT = new Set([4, 17, 32, 613]);
const CODIGO_TOKEN_INVALIDO = 190;
const CODIGO_OBJETO_INEXISTENTE = 100;

/**
 * Decide, a partir do erro devolvido pela Graph API, se o objeto realmente
 * não existe mais. Exige sinal explícito — nunca deduz por ausência.
 */
function pareceObjetoInexistente(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: number; message?: string; type?: string };
  if (e.code === CODIGO_TOKEN_INVALIDO) return false;
  if (typeof e.code === "number" && CODIGOS_RATE_LIMIT.has(e.code)) return false;

  const msg = (e.message ?? "").toLowerCase();
  const mensagemExplicita =
    msg.includes("does not exist") ||
    msg.includes("unsupported get request") ||
    msg.includes("object with id");

  return e.code === CODIGO_OBJETO_INEXISTENTE && mensagemExplicita;

}

export async function verificarPublicados(): Promise<ResumoVerificacao> {
  const resumo: ResumoVerificacao = {
    verificados: 0,
    removidos: 0,
    metricasAtualizadas: 0,
    interrompidoPorToken: false,
    erros: [],
  };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cfg } = await supabaseAdmin
    .from("ig_config")
    .select("access_token")
    .limit(1)
    .maybeSingle();
  if (!cfg?.access_token) {
    resumo.erros.push("Sem configuração Meta salva");
    return resumo;
  }

  // Ordem estável: verificados há mais tempo primeiro; nulos entram na frente.
  // Lote pequeno e fixo — não há risco de passar de 1000 linhas.
  const { data: posts, error } = await supabaseAdmin
    .from("posts_agendados")
    .select("id, instagram_media_id, verificado_em")
    .eq("status", "publicado")
    .eq("removido_no_instagram", false)
    .not("instagram_media_id", "is", null)
    .order("verificado_em", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true })
    .limit(LOTE);

  if (error) {
    resumo.erros.push(error.message);
    return resumo;
  }

  const agora = new Date().toISOString();

  for (const p of posts ?? []) {
    const mediaId = p.instagram_media_id;
    if (!mediaId) continue;

    let body: any;
    try {
      const resp = await fetch(
        `${GRAPH}/${mediaId}?fields=id,like_count,comments_count&access_token=${encodeURIComponent(cfg.access_token)}`,
      );
      body = await resp.json().catch(() => null);
      if (!body) {
        // Resposta sem corpo: inconclusiva, tenta de novo depois.
        resumo.erros.push(`Resposta vazia da Meta para ${mediaId}`);
        continue;
      }
    } catch (e) {
      resumo.erros.push(e instanceof Error ? e.message : "Falha de rede na verificação");
      continue;
    }

    const err = body.error;

    if (err?.code === CODIGO_TOKEN_INVALIDO) {
      // Token inválido: varrer o resto é inútil e só gera ruído.
      resumo.interrompidoPorToken = true;
      resumo.erros.push(`Token inválido/expirado: ${err.message ?? ""}`.trim());
      break;
    }

    if (err) {
      if (pareceObjetoInexistente(err)) {
        const { error: updErr } = await supabaseAdmin
          .from("posts_agendados")
          .update({ removido_no_instagram: true, verificado_em: agora })
          .eq("id", p.id);
        if (updErr) resumo.erros.push(updErr.message);
        else {
          const { registrarTentativa } = await import("@/lib/tentativas.server");
          await registrarTentativa(supabaseAdmin, {
            postId: p.id,
            evento: "removido",
            etapa: "verificacao",
            mensagem: "Publicação não existe mais no Instagram",
            detalhe: { error: err as Record<string, unknown> },
          });
          resumo.removidos++;
          resumo.verificados++;
        }
      } else {
        // Erro inconclusivo: preserva verificado_em para reavaliar depois.
        resumo.erros.push(err.message ?? `Erro ${err.code ?? "?"} na verificação`);
      }
      continue;
    }

    if (body.id) {
      // O post existe: aproveitamos a mesma rodada para atualizar o desempenho.
      const insights = await lerInsights(mediaId, cfg.access_token);
      const metricas: MetricasMidia = {
        curtidas: numeroOuNulo(body.like_count),
        comentarios: numeroOuNulo(body.comments_count),
        compartilhamentos: insights.compartilhamentos,
        reposts: insights.reposts,
      };
      const temAlguma = Object.values(metricas).some((v) => v !== null);

      const { error: updErr } = await supabaseAdmin
        .from("posts_agendados")
        .update({
          verificado_em: agora,
          ...(temAlguma ? { ...metricas, metricas_em: agora } : {}),
        })
        .eq("id", p.id);
      if (updErr) resumo.erros.push(updErr.message);
      else {
        resumo.verificados++;
        if (temAlguma) resumo.metricasAtualizadas++;
      }
    }
  }

  resumo.erros = resumo.erros.slice(0, 5);
  return resumo;
}
