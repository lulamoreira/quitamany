
CREATE TABLE IF NOT EXISTS public.meta_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando',
  erro TEXT,
  access_token TEXT,
  paginas JSONB,
  consumido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_states_state ON public.meta_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_states_criado_em ON public.meta_oauth_states(criado_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_oauth_states TO authenticated;
GRANT ALL ON public.meta_oauth_states TO service_role;

ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_oauth_states admin all" ON public.meta_oauth_states;
CREATE POLICY "meta_oauth_states admin all" ON public.meta_oauth_states
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Cron: renovação semanal de tokens
DO $$
DECLARE
  base_url TEXT := 'https://quitamany.lovable.app';
  cron_secret TEXT := current_setting('app.cron_secret', true);
BEGIN
  BEGIN
    PERFORM cron.unschedule('meta-renovar-tokens');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM cron.schedule(
    'meta-renovar-tokens',
    '17 4 * * 1',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
        body := '{}'::jsonb
      );
    $cmd$, base_url || '/api/public/hooks/renovar-tokens')
  );
END $$;
