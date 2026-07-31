// Cliente do Lovable AI Gateway usado pelas rotas de geração de imagens.
// Server-only: LOVABLE_API_KEY é lida dentro da função, nunca no escopo do módulo.

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const GATEWAY_TIMEOUT_MS = 90_000;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function callGateway(
  body: unknown,
): Promise<{ ok: true; data: any } | { ok: false; response: Response }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.error("[ai-gateway] LOVABLE_API_KEY is not configured");
    return { ok: false, response: jsonResponse({ error: "Serviço de IA não configurado." }, 500) };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[ai-gateway] request failed [${res.status}]: ${text}`);
      if (res.status === 429) {
        return {
          ok: false,
          response: jsonResponse(
            { error: "Muitas requisições. Aguarde alguns segundos e tente novamente." },
            429,
          ),
        };
      }
      if (res.status === 402) {
        return {
          ok: false,
          response: jsonResponse(
            { error: "Créditos de IA esgotados. Adicione créditos no workspace do Lovable." },
            402,
          ),
        };
      }
      return {
        ok: false,
        response: jsonResponse(
          { error: `Falha na chamada de IA (${res.status}). ${text.slice(0, 300)}` },
          502,
        ),
      };
    }

    return { ok: true, data: await res.json() };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[ai-gateway] call threw:", error);
    return {
      ok: false,
      response: jsonResponse(
        {
          error: aborted
            ? "A IA demorou mais de 90 segundos para responder. Tente novamente."
            : "Não foi possível falar com o serviço de IA.",
        },
        aborted ? 504 : 500,
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parseLooseJson<T>(raw: string): T | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
