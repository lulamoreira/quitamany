CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.ig_config
  ADD COLUMN IF NOT EXISTS ultima_execucao_motor timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_execucao_resultado jsonb;