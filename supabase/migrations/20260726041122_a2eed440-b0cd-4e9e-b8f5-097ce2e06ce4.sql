
-- QuitaMany module: contatos, conversas, mensagens, automacoes, eventos_webhook

CREATE TYPE conversa_modo AS ENUM ('automatico', 'humano');
CREATE TYPE msg_direcao AS ENUM ('recebida', 'enviada');
CREATE TYPE msg_autor AS ENUM ('robo', 'humano');
CREATE TYPE automacao_tipo AS ENUM ('gatilho_comentario', 'palavra_chave_dm', 'boas_vindas');

-- CONTATOS
CREATE TABLE public.contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_id text NOT NULL UNIQUE,
  username text,
  nome text,
  foto_url text,
  etiquetas text[] NOT NULL DEFAULT '{}',
  notas text NOT NULL DEFAULT '',
  primeira_interacao timestamptz NOT NULL DEFAULT now(),
  ultima_interacao timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contatos TO authenticated;
GRANT ALL ON public.contatos TO service_role;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ou editor le contatos" ON public.contatos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin ou editor cria contatos" ON public.contatos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin ou editor atualiza contatos" ON public.contatos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin deleta contatos" ON public.contatos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER touch_contatos BEFORE UPDATE ON public.contatos FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- CONVERSAS
CREATE TABLE public.conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  modo conversa_modo NOT NULL DEFAULT 'automatico',
  janela_expira_em timestamptz,
  ultima_mensagem text,
  ultima_msg_em timestamptz,
  nao_lidas int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contato_id)
);
CREATE INDEX idx_conversas_ultima ON public.conversas (ultima_msg_em DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas TO authenticated;
GRANT ALL ON public.conversas TO service_role;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ou editor le conversas" ON public.conversas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin ou editor cria conversas" ON public.conversas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin ou editor atualiza conversas" ON public.conversas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin deleta conversas" ON public.conversas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER touch_conversas BEFORE UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- MENSAGENS
CREATE TABLE public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  direcao msg_direcao NOT NULL,
  texto text NOT NULL DEFAULT '',
  enviada_por msg_autor,
  payload_bruto jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensagens_conversa ON public.mensagens (conversa_id, criado_em);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ou editor le mensagens" ON public.mensagens FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin ou editor cria mensagens" ON public.mensagens FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- AUTOMACOES
CREATE TABLE public.automacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo automacao_tipo NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  palavras text[] NOT NULL DEFAULT '{}',
  post_ig_id text,
  resposta_comentario text,
  resposta_dm text NOT NULL DEFAULT '',
  botoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  etiqueta_aplicar text,
  execucoes int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes TO authenticated;
GRANT ALL ON public.automacoes TO service_role;
ALTER TABLE public.automacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ou editor le automacoes" ON public.automacoes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin ou editor cria automacoes" ON public.automacoes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin ou editor atualiza automacoes" ON public.automacoes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "admin deleta automacoes" ON public.automacoes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER touch_automacoes BEFORE UPDATE ON public.automacoes FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- EVENTOS_WEBHOOK
CREATE TABLE public.eventos_webhook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  payload jsonb,
  processado boolean NOT NULL DEFAULT false,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eventos_webhook_criado ON public.eventos_webhook (criado_em DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_webhook TO authenticated;
GRANT ALL ON public.eventos_webhook TO service_role;
ALTER TABLE public.eventos_webhook ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le eventos webhook" ON public.eventos_webhook FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;

-- Seed automations
INSERT INTO public.automacoes (nome, tipo, ativa, palavras, resposta_comentario, resposta_dm, botoes, etiqueta_aplicar) VALUES
('Promo QUITANDA', 'gatilho_comentario', true, ARRAY['QUITANDA'], 'Te chamei na DM! 💚', 'Oba! Você entrou na promo 🥕 Me diz qual peça você quer que eu te passo valores e prazo!', '[]'::jsonb, 'promo'),
('Orçamento', 'palavra_chave_dm', true, ARRAY['preço','preco','valor','orçamento','orcamento','quanto custa'], NULL, 'Ótima escolha! 😄 Me manda a peça que você quer (pode ser print ou nome) que te passo o valor certinho. Orçamento grátis e sem compromisso!', '[]'::jsonb, 'lead'),
('Boas-vindas', 'boas_vindas', true, ARRAY[]::text[], NULL, 'Oi! Aqui é a Quitanda 3D 🥕 Que bom te ver por aqui! Me conta: quer ver o catálogo, pedir um orçamento ou tirar uma dúvida?', '[{"titulo":"Catálogo"},{"titulo":"Orçamento"},{"titulo":"Dúvida"}]'::jsonb, NULL);
