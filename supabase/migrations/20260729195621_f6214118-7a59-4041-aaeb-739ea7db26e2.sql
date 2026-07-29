ALTER TABLE public.posts_agendados
  ADD COLUMN IF NOT EXISTS removido_no_instagram boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verificado_em timestamptz NULL;