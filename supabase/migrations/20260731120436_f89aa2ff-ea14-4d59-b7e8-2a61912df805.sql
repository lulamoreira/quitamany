ALTER TABLE public.posts_agendados
  ADD COLUMN IF NOT EXISTS tipo_midia text NOT NULL DEFAULT 'reels',
  ADD COLUMN IF NOT EXISTS midia_itens jsonb NULL;

ALTER TABLE public.posts_agendados
  ADD CONSTRAINT posts_agendados_tipo_midia_check
  CHECK (tipo_midia IN ('reels', 'imagem', 'carrossel'));