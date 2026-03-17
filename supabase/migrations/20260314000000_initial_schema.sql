-- Initial schema for Radar Financeiro

DROP TABLE IF EXISTS receitas CASCADE;
DROP TABLE IF EXISTS despesas CASCADE;
DROP TABLE IF EXISTS cartoes CASCADE;
DROP TABLE IF EXISTS titulares CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;

-- 1. Categorias
CREATE TABLE categorias (
    linha SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    keywords TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Titulares
CREATE TABLE titulares (
    linha SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    foto TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, nome)
);

-- 3. Cartões
CREATE TABLE cartoes (
    linha SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    titular_nome TEXT NOT NULL,
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
    dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento >= 1 AND dia_fechamento <= 31),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Despesas
CREATE TABLE despesas (
    linha SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    categoria_label TEXT,
    valor DECIMAL(12,2) NOT NULL,
    parcela TEXT,
    vencimento TEXT,
    vencimento_iso DATE NOT NULL,
    competencia TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pago', 'Em aberto', 'Vencida', 'Hoje')),
    titular_nome TEXT NOT NULL,
    cartao_nome TEXT,
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Receitas
CREATE TABLE receitas (
    linha SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    parcelas TEXT,
    recebimento TEXT,
    competencia TEXT NOT NULL,
    titular_nome TEXT NOT NULL,
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE titulares ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;

-- 6. Workspace Members (Shared Access)
CREATE TABLE workspace_members (
    id SERIAL PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(owner_id, member_id)
);

-- 7. Workspace Invites
CREATE TABLE workspace_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for new tables
CREATE POLICY "Users can see their own memberships" ON workspace_members 
    FOR SELECT USING (auth.uid() = member_id OR auth.uid() = owner_id);

CREATE POLICY "Owners can manage memberships" ON workspace_members 
    FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Users can see invites sent to them or by them" ON workspace_invites 
    FOR SELECT USING (auth.uid() = owner_id OR invitee_email = (select email from auth.users where id = auth.uid()));

CREATE POLICY "Owners can manage invites" ON workspace_invites 
    FOR ALL USING (auth.uid() = owner_id);

-- Update RLS Policies for existing tables to allow shared access
DROP POLICY IF EXISTS "Users can manage their own categorias" ON categorias;
CREATE POLICY "Users can manage categorias in their workspaces" ON categorias 
    FOR ALL USING (
        auth.uid() = user_id OR 
        user_id IN (SELECT owner_id FROM workspace_members WHERE member_id = auth.uid() AND role = 'editor')
    );

DROP POLICY IF EXISTS "Users can manage their own titulares" ON titulares;
CREATE POLICY "Users can manage titulares in their workspaces" ON titulares 
    FOR ALL USING (
        auth.uid() = user_id OR 
        user_id IN (SELECT owner_id FROM workspace_members WHERE member_id = auth.uid() AND role = 'editor')
    );

DROP POLICY IF EXISTS "Users can manage their own cartoes" ON cartoes;
CREATE POLICY "Users can manage cartoes in their workspaces" ON cartoes 
    FOR ALL USING (
        auth.uid() = user_id OR 
        user_id IN (SELECT owner_id FROM workspace_members WHERE member_id = auth.uid() AND role = 'editor')
    );

DROP POLICY IF EXISTS "Users can manage their own despesas" ON despesas;
CREATE POLICY "Users can manage despesas in their workspaces" ON despesas 
    FOR ALL USING (
        auth.uid() = user_id OR 
        user_id IN (SELECT owner_id FROM workspace_members WHERE member_id = auth.uid() AND role = 'editor')
    );

DROP POLICY IF EXISTS "Users can manage their own receitas" ON receitas;
CREATE POLICY "Users can manage receitas in their workspaces" ON receitas 
    FOR ALL USING (
        auth.uid() = user_id OR 
        user_id IN (SELECT owner_id FROM workspace_members WHERE member_id = auth.uid() AND role = 'editor')
    );

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_categorias_updated_at ON categorias;
CREATE TRIGGER update_categorias_updated_at BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_titulares_updated_at ON titulares;
CREATE TRIGGER update_titulares_updated_at BEFORE UPDATE ON titulares FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_cartoes_updated_at ON cartoes;
CREATE TRIGGER update_cartoes_updated_at BEFORE UPDATE ON cartoes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_despesas_updated_at ON despesas;
CREATE TRIGGER update_despesas_updated_at BEFORE UPDATE ON despesas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_receitas_updated_at ON receitas;
CREATE TRIGGER update_receitas_updated_at BEFORE UPDATE ON receitas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
