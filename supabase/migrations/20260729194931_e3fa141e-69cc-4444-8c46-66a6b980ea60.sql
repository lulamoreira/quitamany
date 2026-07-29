ALTER TABLE public.posts_agendados REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts_agendados;