-- =========================================================================
-- SCRIPT UNIFICADO: MULTI-TENANCY (SISTEMA DE FAMÍLIAS)
-- Versão Final Corrigida: Profiles (Nome, Tipo, Foto) + Migração
-- =========================================================================

-- 0. RESET DO SCHEMA
DROP TABLE IF EXISTS receitas CASCADE;
DROP TABLE IF EXISTS despesas CASCADE;
DROP TABLE IF EXISTS cartoes CASCADE;
DROP TABLE IF EXISTS cartoes_config CASCADE;
DROP TABLE IF EXISTS titulares CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS table_notas CASCADE;
DROP TABLE IF EXISTS notas CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS convites CASCADE;

-- 1. TABELA DE PERFIS (PROFILES)
-- Tipo: 'titular' (quem criou a família) ou 'membro' (quem foi convidado)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    nome TEXT, 
    tipo TEXT NOT NULL DEFAULT 'membro',
    foto TEXT, 
    family_id UUID NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE CONVITES
-- Armazena convites pendentes por e-mail
CREATE TABLE convites (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. FUNÇÃO DE APOIO: Obter Family ID do usuário logado
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT family_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. GATILHO PARA NOVOS USUÁRIOS (AUTH.USERS -> PROFILES)
-- Agora verifica se há um convite ativo para o e-mail que está se cadastrando
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  target_family_id UUID;
BEGIN
  -- Verifica se existe um convite para este e-mail
  SELECT family_id INTO target_family_id FROM public.convites WHERE email = new.email;
  
  IF target_family_id IS NOT NULL THEN
    -- Se houver convite, entra na família convidada como 'membro' e apaga o convite
    INSERT INTO public.profiles (id, email, family_id, nome, foto, tipo)
    VALUES (
      new.id, 
      new.email, 
      target_family_id, 
      COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.raw_user_meta_data->>'avatar_url',
      'membro'
    );
    DELETE FROM public.convites WHERE email = new.email;
  ELSE
    -- Se não houver convite, cria uma nova família e entra como 'titular'
    INSERT INTO public.profiles (id, email, family_id, nome, foto, tipo)
    VALUES (
      new.id, 
      new.email, 
      gen_random_uuid(), 
      COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.raw_user_meta_data->>'avatar_url',
      'titular'
    );
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. MIGRAÇÃO: CRIAR PERFIS PARA USUÁRIOS QUE JÁ EXISTEM
INSERT INTO public.profiles (id, email, family_id, nome, foto, tipo) 
SELECT 
    id, 
    email, 
    gen_random_uuid(), 
    COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    raw_user_meta_data->>'avatar_url',
    'membro'
FROM auth.users 
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 5. TABELAS DE NEGÓCIO (COMPARTILHADAS POR FAMILY_ID)
-- (Tabela de categorias removida em favor de categorização automática por texto)

CREATE TABLE titulares (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    foto TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(family_id, nome)
);

CREATE TABLE cartoes_config (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome_cartao TEXT NOT NULL,
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    dia_fechamento INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cartoes (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cartao_id INTEGER REFERENCES cartoes_config(id) ON DELETE CASCADE,
    estabelecimento TEXT NOT NULL,
    categoria TEXT, -- Texto livre (Gerado automaticamente)
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    valor DECIMAL(12,2) NOT NULL,
    parcela_atual INTEGER DEFAULT 1,
    parcela_total INTEGER DEFAULT 1,
    data_compra DATE NOT NULL,
    competencia TEXT NOT NULL,
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE despesas (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    categoria TEXT, -- Texto livre (Gerado automaticamente)
    valor DECIMAL(12,2) NOT NULL,
    parcela_atual INTEGER DEFAULT 1,
    parcela_total INTEGER DEFAULT 1,
    vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Em aberto' CHECK (status IN ('Pago', 'Em aberto', 'Vencida', 'Hoje')),
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    competencia TEXT NOT NULL,
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE receitas (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    categoria TEXT, -- Texto livre (Gerado automaticamente)
    valor DECIMAL(12,2) NOT NULL,
    data_recebimento DATE NOT NULL,
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    competencia TEXT NOT NULL,
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE table_notas (
    family_id UUID PRIMARY KEY DEFAULT get_my_family_id(),
    conteudo TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. SEGURANÇA (ROW LEVEL SECURITY)

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE titulares ENABLE ROW LEVEL SECURITY;
ALTER TABLE titulares ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura de membros da família" ON profiles FOR SELECT USING (id = auth.uid() OR family_id = get_my_family_id());
CREATE POLICY "Atualização do próprio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Convites: Só o titular da família pode gerenciar (ver, criar, deletar)
CREATE POLICY "Gerenciamento de Convites" ON convites FOR ALL 
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'titular' AND family_id = convites.family_id))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'titular' AND family_id = convites.family_id));

DO $$ 
DECLARE 
    tab TEXT;
BEGIN
    FOR tab IN SELECT table_name FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name IN ('titulares', 'cartoes_config', 'cartoes', 'despesas', 'receitas', 'table_notas')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Acesso por Família" ON %I', tab);
        EXECUTE format('CREATE POLICY "Acesso por Família" ON %I FOR ALL USING (family_id = get_my_family_id()) WITH CHECK (family_id = get_my_family_id())', tab);
    END LOOP;
END $$;

-- 7. UTILITÁRIOS (UPDATED_AT)
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_despesas_updated_at BEFORE UPDATE ON despesas FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER tr_notas_updated_at BEFORE UPDATE ON table_notas FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();