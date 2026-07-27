ALTER TABLE public.posts_agendados
  ADD COLUMN IF NOT EXISTS instagram_media_id text,
  ADD COLUMN IF NOT EXISTS instagram_permalink text;