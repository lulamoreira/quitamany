import { createFileRoute } from "@tanstack/react-router";
import { callGateway, jsonResponse, preflight } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/recolor-image")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        let payload: { imageBase64?: unknown; objeto?: unknown; hex?: unknown };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
        }
        const { imageBase64, objeto, hex } = payload;
        if (typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image/")) {
          return jsonResponse({ error: "Imagem ausente ou em formato inválido." }, 400);
        }
        if (typeof objeto !== "string" || !objeto.trim()) {
          return jsonResponse({ error: "Objeto não informado." }, 400);
        }
        if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
          return jsonResponse({ error: "Cor hex inválida." }, 400);
        }
        const prompt = `Change ONLY the color of the ${objeto} in this photo to the exact color ${hex}. Preserve the original shading, highlights, shadows, texture, material, fabric weave, reflections and every detail of the object's surface — only the hue changes, as if the object had been manufactured in that color. Do NOT alter the background, lighting, framing, composition, other objects, people, or any part of the image outside the ${objeto}. Keep the same resolution and aspect ratio. Output the edited image.`;
        const result = await callGateway({
          model: "google/gemini-2.5-flash-image",
          modalities: ["image", "text"],
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
        });
        if (!result.ok) return result.response;
        const url = result.data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (typeof url !== "string" || !url.startsWith("data:image/")) {
          console.error(
            "[recolor-image] resposta sem imagem:",
            JSON.stringify(result.data).slice(0, 1000),
          );
          return jsonResponse(
            { error: "A IA não retornou uma imagem para esta cor. Tente novamente." },
            502,
          );
        }
        return jsonResponse({ imageUrl: url });
      },
    },
  },
});
