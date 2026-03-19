-- =========================================================================
-- SCRIPT DE MIGRAÇÃO: MULTI-TENANCY (SISTEMA DE FAMÍLIAS)
-- Este script refaz o banco de dados para permitir que vários membros
-- de uma mesma família compartilhem as mesmas receitas e despesas.
-- =========================================================================

-- Reset do schema (Cuidado: apaga os dados existentes!)
DROP TABLE IF EXISTS receitas CASCADE;
DROP TABLE IF EXISTS despesas CASCADE;
DROP TABLE IF EXISTS cartoes CASCADE;
DROP TABLE IF EXISTS cartoes_config CASCADE;
DROP TABLE IF EXISTS titulares CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS notas CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Tabela de Perfis (Profiles)
-- Faz a ligação de cada usuário do Auth.Users a uma família específica
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    family_id UUID NOT NULL, -- UUID único que identifica o grupo/família
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Usuários podem ler perfis de quem compartilha o mesmo family_id
-- Usamos get_my_family_id() que é SECURITY DEFINER para evitar recursão
CREATE POLICY "Leitura de membros da família" ON profiles 
    FOR SELECT USING (id = auth.uid() OR family_id = get_my_family_id());

-- Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Atualização do próprio perfil" ON profiles 
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Gatilho para criar perfil automaticamente ao cadastrar novo usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, family_id)
  VALUES (new.id, new.email, gen_random_uuid());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Se o gatilho já existir, remova-o antes de recriar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- IMPORTANTE: Para usuários que já existem, execute este comando manualmente no SQL Editor:
-- INSERT INTO public.profiles (id, email, family_id) 
-- SELECT id, email, gen_random_uuid() FROM auth.users 
-- WHERE id NOT IN (SELECT id FROM public.profiles);


-- 2. Função de Segurança para obter o family_id do usuário logado
-- Usada para preenchimento automático e validação de permissões
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT family_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Categorias (Compartilhadas pela família)
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Criador
    label TEXT NOT NULL,
    keywords TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Titulares (Membros da família ou apenas nomes de titulação para despesas da casa)
CREATE TABLE titulares (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Criador
    nome TEXT NOT NULL,
    foto TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(family_id, nome)
);

-- 5. Configuração de Cartões (Compartilhada pela família)
CREATE TABLE cartoes_config (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Criador
    nome_cartao TEXT NOT NULL,
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    dia_fechamento INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Lançamentos de Cartão (Visíveis para todos na mesma família)
CREATE TABLE cartoes (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Identifica quem lançou
    cartao_id INTEGER REFERENCES cartoes_config(id) ON DELETE CASCADE,
    estabelecimento TEXT NOT NULL,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    valor DECIMAL(12,2) NOT NULL,
    parcela_atual INTEGER DEFAULT 1,
    parcela_total INTEGER DEFAULT 1,
    data_compra DATE NOT NULL,
    competencia TEXT NOT NULL, -- Formato "MM/YYYY"
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Despesas Fixas e Variáveis (Unificadas por família)
CREATE TABLE despesas (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Identifica quem lançou (opcional)
    descricao TEXT NOT NULL,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
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

-- 8. Receitas (Unificadas por família)
CREATE TABLE receitas (
    id SERIAL PRIMARY KEY,
    family_id UUID NOT NULL DEFAULT get_my_family_id(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Identifica quem lançou (opcional)
    descricao TEXT NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_recebimento DATE NOT NULL,
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    competencia TEXT NOT NULL,
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Notas/Lembretes (Uma nota compartilhada por família)
CREATE TABLE notas (
    family_id UUID PRIMARY KEY DEFAULT get_my_family_id(),
    conteudo TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- ==================== RLS (FAMILY LEVEL SECURITY) ====================

-- Habilitar RLS em todas as tabelas
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE titulares ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;

-- Políticas Unificadas: O SELECT, INSERT, UPDATE e DELETE dependem apenas do family_id
-- O check "family_id = get_my_family_id()" garante o isolamento entre famílias.

CREATE POLICY "Acesso por Família" ON categorias FOR ALL USING (family_id = get_my_family_id()) WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "Acesso por Família" ON titulares FOR ALL USING (family_id = get_my_family_id()) WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "Acesso por Família" ON cartoes_config FOR ALL USING (family_id = get_my_family_id()) WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "Acesso por Família" ON cartoes FOR ALL USING (family_id = get_my_family_id()) WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "Acesso por Família" ON despesas FOR ALL USING (family_id = get_my_family_id()) WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "Acesso por Família" ON receitas FOR ALL USING (family_id = get_my_family_id()) WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "Acesso por Família" ON notas FOR ALL USING (family_id = get_my_family_id()) WITH CHECK (family_id = get_my_family_id());

-- ==================== TRIGGERS (UTILITIES) ====================

-- Função para atualizar updated_at automaticamente na tabela despesas e notas
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_despesas_updated_at BEFORE UPDATE ON despesas FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER tr_notas_updated_at BEFORE UPDATE ON notas FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
