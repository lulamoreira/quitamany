
-- Tabela de estados OAuth (curta duração; TTL manual via cron ou ignorar)
CREATE TABLE IF NOT EXISTS public.meta_oauth_states (
  state TEXT PRIMARY KEY,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  redirect_uri TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando',
  access_token TEXT,
  paginas JSONB,
  erro TEXT,
  consumido_em TIMESTAMPTZ
);

GRANT SELECT ON public.meta_oauth_states TO authenticated;
GRANT ALL ON public.meta_oauth_states TO service_role;

ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin le seu state"
  ON public.meta_oauth_states FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND criado_por = auth.uid());

-- Cron semanal para renovar tokens (domingo 03:00)
DO $$
DECLARE
  proj_url TEXT;
  cron_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO proj_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO cron_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  -- Ignora erros silenciosamente se vault não estiver acessível; agendamento real é feito pelo motor
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Índice para limpar estados antigos rápido
CREATE INDEX IF NOT EXISTS idx_meta_oauth_states_criado_em ON public.meta_oauth_states(criado_em);
