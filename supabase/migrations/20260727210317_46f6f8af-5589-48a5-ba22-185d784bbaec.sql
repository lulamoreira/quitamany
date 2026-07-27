ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_out_em timestamptz NULL;

ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS mid text NULL,
  ADD COLUMN IF NOT EXISTS apagada boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_mensagens_mid ON public.mensagens(mid);