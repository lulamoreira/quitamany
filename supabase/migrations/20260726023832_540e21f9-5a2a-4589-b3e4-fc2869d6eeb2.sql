
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'pendente');
CREATE TYPE public.post_status AS ENUM ('rascunho', 'agendado', 'processando', 'publicado', 'erro');

-- Tabela user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função has_role (SECURITY DEFINER, evita recursão em policies)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função helper: papel principal do usuário (maior privilégio)
CREATE OR REPLACE FUNCTION public.current_role_of(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END
  LIMIT 1
$$;

-- Policies user_roles: usuário vê o próprio papel; admin gerencia tudo
CREATE POLICY "usuario ve proprio papel" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin le todos os papeis" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insere papeis" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin atualiza papeis" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin exclui papeis" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: primeiro usuário vira admin; demais viram pendente
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total INT;
BEGIN
  SELECT COUNT(*) INTO total FROM public.user_roles;
  IF total = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'pendente')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Tabela ig_config (linha única)
CREATE TABLE public.ig_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  conta_username TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_config TO authenticated;
GRANT ALL ON public.ig_config TO service_role;
ALTER TABLE public.ig_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin le ig_config" ON public.ig_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insere ig_config" ON public.ig_config
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin atualiza ig_config" ON public.ig_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin deleta ig_config" ON public.ig_config
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tabela posts_agendados
CREATE TABLE public.posts_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT,
  legenda TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '',
  video_path TEXT,
  video_url TEXT,
  agendado_para TIMESTAMPTZ,
  status public.post_status NOT NULL DEFAULT 'rascunho',
  container_id TEXT,
  media_id TEXT,
  permalink TEXT,
  erro_msg TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  publicado_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_status_agendado ON public.posts_agendados (status, agendado_para);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts_agendados TO authenticated;
GRANT ALL ON public.posts_agendados TO service_role;
ALTER TABLE public.posts_agendados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin ou editor le posts" ON public.posts_agendados
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "admin ou editor cria posts" ON public.posts_agendados
  FOR INSERT TO authenticated WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
    AND auth.uid() = criado_por
  );
CREATE POLICY "admin ou editor atualiza posts" ON public.posts_agendados
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "admin ou editor deleta posts" ON public.posts_agendados
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );

-- updated_at automático
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON public.posts_agendados
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_ig_config_updated_at BEFORE UPDATE ON public.ig_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
