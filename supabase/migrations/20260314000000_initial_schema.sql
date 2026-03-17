-- Reset do schema (Cuidado: apaga os dados existentes)
DROP TABLE IF EXISTS receitas CASCADE;
DROP TABLE IF EXISTS despesas CASCADE;
DROP TABLE IF EXISTS cartoes CASCADE;
DROP TABLE IF EXISTS cartoes_config CASCADE;
DROP TABLE IF EXISTS titulares CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS notas CASCADE;

-- 1. Categorias (Baseado na aba CATEGORIAS)
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    keywords TEXT, -- Para busca automática que seu script sugeria
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Titulares (Baseado na aba LOGIN)
CREATE TABLE titulares (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    foto TEXT, -- URL da imagem
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, nome)
);

-- 3. Cadastro/Configuração de Cartões (Baseado na aba CONFIG)
CREATE TABLE cartoes_config (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_cartao TEXT NOT NULL,
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    dia_fechamento INTEGER NOT NULL DEFAULT 10, -- Dias antes do vencimento
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Lançamentos de Cartão (Baseado na aba CARTOES)
-- Aqui ficam as compras individuais que depois são consolidadas
CREATE TABLE cartoes (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cartao_id INTEGER REFERENCES cartoes_config(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    valor DECIMAL(12,2) NOT NULL,
    parcela_atual INTEGER DEFAULT 1,
    parcela_total INTEGER DEFAULT 1,
    vencimento_original DATE NOT NULL,
    competencia TEXT NOT NULL, -- Formato "MM/YYYY"
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Despesas Fixas e Variáveis (Baseado na aba DESPESAS)
-- Inclui as faturas consolidadas de cartão
CREATE TABLE despesas (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    valor DECIMAL(12,2) NOT NULL,
    parcela_atual INTEGER DEFAULT 1,
    parcela_total INTEGER DEFAULT 1,
    vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Em aberto' CHECK (status IN ('Pago', 'Em aberto', 'Vencida', 'Hoje')),
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    cartao_vencimento_id INTEGER REFERENCES cartoes_config(id), -- Se for uma fatura consolidada
    competencia TEXT NOT NULL,
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Receitas (Baseado na aba RECEITAS)
CREATE TABLE receitas (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_recebimento DATE NOT NULL,
    titular_id INTEGER REFERENCES titulares(id) ON DELETE CASCADE,
    competencia TEXT NOT NULL,
    simulada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Notas (Baseado na aba NOTAS)
CREATE TABLE notas (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    conteudo TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

---

-- Habilitar RLS (Row Level Security)
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE titulares ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Exemplo para Despesas - Repetir para as outras)
CREATE POLICY "Individuais" ON despesas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Individuais" ON receitas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Individuais" ON cartoes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Individuais" ON cartoes_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Individuais" ON titulares FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Individuais" ON categorias FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Individuais" ON notas FOR ALL USING (auth.uid() = user_id);

-- Função para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_despesas_updated_at BEFORE UPDATE ON despesas FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();