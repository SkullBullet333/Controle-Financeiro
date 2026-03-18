-- Add titular_id and updated_at to cartoes table
ALTER TABLE cartoes ADD COLUMN titular_id BIGINT REFERENCES titulares(id);
ALTER TABLE cartoes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Add updated_at to receitas table
ALTER TABLE receitas ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Rename columns in cartoes to match the code
ALTER TABLE cartoes RENAME COLUMN vencimento_original TO data_compra;
ALTER TABLE cartoes RENAME COLUMN descricao TO estabelecimento;

-- Add triggers for updated_at
CREATE TRIGGER tr_cartoes_updated_at BEFORE UPDATE ON cartoes FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER tr_receitas_updated_at BEFORE UPDATE ON receitas FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
