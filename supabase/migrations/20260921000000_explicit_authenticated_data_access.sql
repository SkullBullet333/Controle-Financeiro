-- O staging e a produção não dependem da opção global de expor tabelas novas.
-- O Data API atende somente sessões autenticadas; as policies RLS continuam
-- sendo a autoridade para cada linha.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  public.profiles,
  public.convites,
  public.titulares,
  public.cartoes_config,
  public.emprestimos,
  public.contas_fixas,
  public.cartoes,
  public.despesas,
  public.receitas,
  public.table_notas,
  public.financial_operation_requests,
  public.contas_fixas_excecoes
FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.convites,
  public.titulares,
  public.cartoes_config,
  public.emprestimos,
  public.contas_fixas,
  public.cartoes,
  public.despesas,
  public.receitas,
  public.table_notas,
  public.financial_operation_requests,
  public.contas_fixas_excecoes
TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
