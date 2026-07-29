CREATE TYPE public.tentativa_evento AS ENUM ('falha', 'reenvio', 'publicado', 'removido');

CREATE TABLE public.post_tentativas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts_agendados(id) ON DELETE CASCADE,
  evento public.tentativa_evento NOT NULL,
  etapa text,
  mensagem text NOT NULL DEFAULT '',
  detalhe jsonb,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_tentativas_post_id ON public.post_tentativas (post_id, criado_em DESC);

GRANT SELECT, INSERT ON public.post_tentativas TO authenticated;
GRANT ALL ON public.post_tentativas TO service_role;

ALTER TABLE public.post_tentativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin ou editor le tentativas"
  ON public.post_tentativas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "admin ou editor registra tentativas"
  ON public.post_tentativas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));