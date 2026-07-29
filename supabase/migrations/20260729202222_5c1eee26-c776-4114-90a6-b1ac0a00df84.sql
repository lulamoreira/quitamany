ALTER TABLE public.posts_agendados
  ADD COLUMN IF NOT EXISTS curtidas integer,
  ADD COLUMN IF NOT EXISTS comentarios integer,
  ADD COLUMN IF NOT EXISTS compartilhamentos integer,
  ADD COLUMN IF NOT EXISTS reposts integer,
  ADD COLUMN IF NOT EXISTS metricas_em timestamp with time zone;