-- Adiciona suporte a lançamentos virtuais em cartões de crédito
ALTER TABLE public.contas_fixas 
ADD COLUMN cartao_id INTEGER REFERENCES public.cartoes_config(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contas_fixas.cartao_id IS 'ID do cartão caso o lançamento virtual seja via cartão de crédito';
