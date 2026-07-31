import { createFileRoute } from "@tanstack/react-router";
import { callGateway, jsonResponse, parseLooseJson, preflight } from "@/lib/ai-gateway.server";

interface IdentifyResult {
  objeto: string;
  descricao: string;
}

export const Route = createFileRoute("/api/identify-objeto")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        let imageBase64: unknown;
        try {
          ({ imageBase64 } = (await request.json()) as { imageBase64?: unknown });
        } catch {
          return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
        }
        if (typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image/")) {
          return jsonResponse({ error: "Imagem ausente ou em formato inválido." }, 400);
        }
        const result = await callGateway({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: [
                    "Analise a foto e identifique o objeto mais em evidência.",
                    'Responda APENAS com JSON no formato {"objeto": string, "descricao": string}.',
                    '"objeto" é o nome curto em português (ex.: "tênis", "camiseta", "carro").',
                    '"descricao" é uma única frase em português dizendo onde ele está na foto.',
                    "Sem texto extra, sem markdown.",
                  ].join(" "),
                },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
        });
        if (!result.ok) return result.response;
        const raw = result.data?.choices?.[0]?.message?.content;
        const parsed = typeof raw === "string" ? parseLooseJson<Partial<IdentifyResult>>(raw) : null;
        if (!parsed || typeof parsed.objeto !== "string" || !parsed.objeto.trim()) {
          console.error("[identify-objeto] resposta não parseável:", raw);
          return jsonResponse({ objeto: "objeto principal", descricao: "" });
        }
        return jsonResponse({
          objeto: parsed.objeto.trim(),
          descricao: typeof parsed.descricao === "string" ? parsed.descricao.trim() : "",
        });
      },
    },
  },
});
