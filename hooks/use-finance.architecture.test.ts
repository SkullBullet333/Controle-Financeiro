import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('contrato arquitetural do carregamento financeiro', () => {
  it('mantém fetchData livre de exclusões no banco', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const fetchStart = source.indexOf('const fetchData = useCallback');
    const fetchEnd = source.indexOf('const fetchProfile = useCallback');

    expect(fetchStart).toBeGreaterThanOrEqual(0);
    expect(fetchEnd).toBeGreaterThan(fetchStart);

    const fetchDataSource = source.slice(fetchStart, fetchEnd);
    expect(fetchDataSource).not.toContain('deletarContaFixaConfig(');
    expect(fetchDataSource).not.toMatch(/supabase[\s\S]*?\.delete\(/);
  });

  it('quita todas as parcelas por uma única operação transacional', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const payoffStart = source.indexOf('const quitarParcelas = async');
    const payoffEnd = source.indexOf('const updateNota = async', payoffStart);

    expect(payoffStart).toBeGreaterThanOrEqual(0);
    expect(payoffEnd).toBeGreaterThan(payoffStart);

    const payoffSource = source.slice(payoffStart, payoffEnd);
    expect(payoffSource).toContain('materializarDespesasVinculadas(');
    expect(payoffSource).not.toContain('for (const p of parcelas)');
    expect(payoffSource).not.toContain('salvarDespesa(');
  });

  it('cria parcelamentos normais somente pela RPC idempotente', () => {
    const source = readFileSync(new URL('../lib/finance-service.ts', import.meta.url), 'utf8');
    const creationStart = source.indexOf('export async function lancarParcelas');
    const creationEnd = source.indexOf('export async function consolidarFaturas', creationStart);

    expect(creationStart).toBeGreaterThanOrEqual(0);
    expect(creationEnd).toBeGreaterThan(creationStart);

    const creationSource = source.slice(creationStart, creationEnd);
    expect(creationSource).toContain("supabase.rpc('criar_lancamentos_parcelados'");
    expect(creationSource).not.toMatch(/supabase\.from\([\s\S]*?\.insert\(/);
  });

  it('mantém a chave da criação enquanto o formulário não mudar', () => {
    const source = readFileSync(new URL('../components/modals.tsx', import.meta.url), 'utf8');

    expect(source).toContain('resolveCreationOperation(');
    expect(source).toContain('pendingCreationOperation.current = operation');
    expect(source).toContain('data.operation_id = operation.id');
  });

  it('identifica recorrências de cartão estruturalmente e ignora uma ocorrência sem apagar a série', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const projectionStart = source.indexOf('const allProjectedCartaoTransacoes = useMemo');
    const projectionEnd = source.indexOf('const filteredCartaoTransacoes', projectionStart);
    const deletionStart = source.indexOf('const deleteCartaoTransacao = async');
    const deletionEnd = source.indexOf('const updateCartaoTransacao = async', deletionStart);

    expect(projectionStart).toBeGreaterThanOrEqual(0);
    expect(projectionEnd).toBeGreaterThan(projectionStart);
    expect(deletionStart).toBeGreaterThanOrEqual(0);
    expect(deletionEnd).toBeGreaterThan(deletionStart);

    const projectionSource = source.slice(projectionStart, projectionEnd);
    const deletionSource = source.slice(deletionStart, deletionEnd);

    expect(projectionSource).toContain('ct.conta_fixa_id');
    expect(projectionSource).toContain('ct.conta_fixa_parcela');
    expect(projectionSource).toContain('conta_fixa_id: cf.id');
    expect(projectionSource).toContain('conta_fixa_parcela: i');
    expect(projectionSource).toContain('!supportsStructuralRecurrences');
    expect(deletionSource).not.toContain('deletarContaFixaConfig(');
    expect(deletionSource).toContain('ignorarOcorrenciaContaFixa(');
    expect(deletionSource).not.toMatch(/from\('cartoes'\)\.delete[\s\S]*?conta_fixa_id/);
  });

  it('encerra séries sem apagar o mestre nem seus vínculos históricos', () => {
    const hookSource = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const serviceSource = readFileSync(new URL('../lib/finance-service.ts', import.meta.url), 'utf8');
    const projectionSource = readFileSync(new URL('../lib/cashflow-projection.ts', import.meta.url), 'utf8');
    const endingStart = hookSource.indexOf('const endContaFixa = async');
    const endingEnd = hookSource.indexOf('const updateDespesa = async', endingStart);
    const serviceStart = serviceSource.indexOf('export async function encerrarContaFixaConfig');
    const serviceEnd = serviceSource.indexOf('export function calculatePresentValue', serviceStart);

    expect(endingStart).toBeGreaterThanOrEqual(0);
    expect(endingEnd).toBeGreaterThan(endingStart);
    expect(serviceStart).toBeGreaterThanOrEqual(0);
    expect(serviceEnd).toBeGreaterThan(serviceStart);

    const endingSource = hookSource.slice(endingStart, endingEnd);
    const lifecycleService = serviceSource.slice(serviceStart, serviceEnd);

    expect(endingSource).toContain("encerrarContaFixaConfig(id, 'cancelado')");
    expect(endingSource).not.toMatch(/\.delete\(/);
    expect(lifecycleService).toContain("supabase.rpc('encerrar_conta_fixa'");
    expect(lifecycleService).not.toContain("from('despesas').update");
    expect(lifecycleService).not.toContain("from('receitas').update");
    const lifecycleChecks = (hookSource.match(/contaFixaPermiteOcorrencia\(/g)?.length || 0)
      + (projectionSource.match(/contaFixaPermiteOcorrencia\(/g)?.length || 0);
    expect(lifecycleChecks).toBeGreaterThanOrEqual(6);
  });

  it('oferece comandos separados para ignorar uma ocorrência e encerrar as futuras', () => {
    const hookSource = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const pageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    const serviceSource = readFileSync(new URL('../lib/finance-service.ts', import.meta.url), 'utf8');

    expect(hookSource).toContain('ignorarOcorrenciaContaFixa(');
    expect(hookSource).toContain('encerrarContaFixaDesde(id, occurrence)');
    expect(serviceSource).toContain("supabase.rpc('ignorar_ocorrencia_conta_fixa'");
    expect(serviceSource).toContain("supabase.rpc('encerrar_conta_fixa_desde'");
    expect(pageSource).toContain('Ignorar ocorrência');
    expect(pageSource).toContain('Encerrar daqui em diante');
  });

  it('carrega a janela selecionada por competência sem corte relativo à data atual', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const fetchStart = source.indexOf('const fetchData = useCallback');
    const fetchEnd = source.indexOf('const fetchProfile = useCallback');
    const fetchDataSource = source.slice(fetchStart, fetchEnd);

    expect(fetchDataSource).toContain(".in('competencia', financialCompetencies)");
    expect(fetchDataSource).toContain('carregarTodasPaginas<Despesa>');
    expect(fetchDataSource).toContain(".or('emprestimo_id.not.is.null,conta_fixa_id.not.is.null')");
    expect(fetchDataSource.match(/carregarTodasPaginas<Despesa>/g)).toHaveLength(3);
    expect(fetchDataSource).toContain('carregarTodasPaginas<Receita>');
    expect(fetchDataSource).toContain('carregarTodasPaginas<CartaoTransacao>');
    expect(fetchDataSource).toContain(".eq('status', 'Em aberto')");
    expect(fetchDataSource).not.toContain('sixMonthsAgo');
    expect(fetchDataSource).not.toMatch(/\.gte\('(vencimento|data_recebimento|data_compra)'/);
  });

  it('isola cada janela financeira em cache próprio e ignora respostas atrasadas', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const cacheSource = readFileSync(new URL('../lib/financial-cache.ts', import.meta.url), 'utf8');
    const fetchStart = source.indexOf('const fetchData = useCallback');
    const fetchEnd = source.indexOf('const fetchProfile = useCallback');
    const fetchDataSource = source.slice(fetchStart, fetchEnd);

    expect(cacheSource).toContain('`fin_cache_${userId}_${windowKey}`');
    expect(fetchDataSource).toContain('financialCacheKey(targetId, financialWindowKey)');
    expect(fetchDataSource).toContain('requestId !== fetchSequence.current');
    expect(source).toContain('purgeLegacyFinancialCache()');
    expect(source).not.toContain('setCompressedCache(');
  });

  it('descarta leituras de perfil de uma sessão anterior', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const profileStart = source.indexOf('const fetchProfile = useCallback');
    const profileEnd = source.indexOf('const updateProfile = async', profileStart);
    const profileSource = source.slice(profileStart, profileEnd);

    expect(profileSource.match(/authenticatedUserId\.current !== profileUserId/g)).toHaveLength(3);
    expect(source).toContain('fetchSequence.current++');
    expect(source).toContain('clearFinancialCache()');
  });

  it('evita recarga financeira nas exclusões administrativas sem vínculos', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const deleteTitularSource = source.slice(source.indexOf('const deleteTitular = async'), source.indexOf('const updateTitular = async'));
    const deleteCartaoSource = source.slice(source.indexOf('const deleteCartao = async'), source.indexOf('const addEmprestimo = async'));

    for (const action of [deleteTitularSource, deleteCartaoSource]) {
      expect(action).toContain('invalidateFinancialSnapshots()');
      expect(action).not.toContain('await fetchData()');
      expect(action).toContain('setConfig(previousConfig)');
    }
  });

  it('atualiza a foto localmente sem recarregar lançamentos', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const profileSource = source.slice(source.indexOf('const updateProfile = async'), source.indexOf('const inviteMember = async'));

    expect(profileSource).toContain('if (photoSynced)');
    expect(profileSource).toContain('invalidateFinancialSnapshots()');
    expect(profileSource).toContain('titulares: prev.titulares.map');
    expect(profileSource).toContain('if (updates.family_id !== undefined && updates.family_id !== familyId)');
  });

  it('não grava cartões em etapas parciais no schema legado', () => {
    const source = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const insertSource = source.slice(source.indexOf('const sendCartaoInsert = async'), source.indexOf('const addCartao = async'));
    const updateSource = source.slice(source.indexOf('const sendCartaoUpdate = async'), source.indexOf('const updateCartao = async'));

    expect(insertSource).toContain('persistCardWithLegacyRetry(');
    expect(insertSource).toContain(".insert([cardPayload]).select()");
    expect(insertSource).not.toContain('.update(');
    expect(updateSource).toContain('persistCardWithLegacyRetry(');
    expect(updateSource).toContain('.update(cardPayload)');
    expect(updateSource).not.toContain('optionalFields');
  });

  it('calcula totais centrais pela regra canônica de centavos', () => {
    const hookSource = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const moneySource = readFileSync(new URL('../lib/money.ts', import.meta.url), 'utf8');
    const selectorsSource = readFileSync(new URL('../lib/finance-selectors.ts', import.meta.url), 'utf8');
    const transactionsViewSource = readFileSync(new URL('../components/despesas-receitas-view.tsx', import.meta.url), 'utf8');
    const radarSource = readFileSync(new URL('../components/radar-view.tsx', import.meta.url), 'utf8');

    expect(moneySource).toContain('export function paraCentavos');
    expect(moneySource).toContain('export function somarDinheiro');
    expect(selectorsSource).toContain('export function calcularResumoFinanceiro');
    expect(selectorsSource).toContain('saldo: subtrairDinheiro(');
    expect(hookSource).toContain('calcularResumoFinanceiro(');
    expect(hookSource).toContain('calcularTotaisPorTitular(');
    expect(transactionsViewSource).toContain('calcularTotaisFluxo(receitas, despesas)');
    expect(radarSource).toContain('calcularScoreOrcamentario(');
    expect(hookSource).not.toMatch(/reduce\(\(.*?\)\s*=>\s*.*?\+\s*(?:Number\()?[^\n]*?\.valor/);
  });

  it('compartilha a mesma projeção de fluxo entre painel e radar', () => {
    const hookSource = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const radarSource = readFileSync(new URL('../components/radar-view.tsx', import.meta.url), 'utf8');
    const projectionSource = readFileSync(new URL('../lib/cashflow-projection.ts', import.meta.url), 'utf8');

    expect(projectionSource).toContain('export function projetarFluxoCaixa');
    expect(hookSource).toContain('projetarFluxoCaixa({');
    expect(radarSource).toContain('projetarFluxoCaixa({');
  });

  it('não considera uma receita recorrente virtual recebida apenas pela data', () => {
    const hookSource = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const start = hookSource.indexOf('const consolidatedReceitas = useMemo');
    const end = hookSource.indexOf('const despesasGerais = useMemo', start);
    const recurringRevenueProjection = hookSource.slice(start, end);

    expect(recurringRevenueProjection).toContain("status: 'Pendente'");
    expect(recurringRevenueProjection).not.toContain("? 'Recebido' : 'Pendente'");
  });

  it('projeta cartões por competência e resolve faturas pela regra estrutural compartilhada', () => {
    const hookSource = readFileSync(new URL('./use-finance.ts', import.meta.url), 'utf8');
    const pageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    const cardsSource = readFileSync(new URL('../components/cards-view.tsx', import.meta.url), 'utf8');
    const cashflowSource = readFileSync(new URL('../lib/cashflow-projection.ts', import.meta.url), 'utf8');
    const projectionSource = readFileSync(new URL('../lib/card-projection.ts', import.meta.url), 'utf8');
    const projectionStart = cardsSource.indexOf('const faturas6MesesData = useMemo');
    const projectionEnd = cardsSource.indexOf('return (', projectionStart);
    const cardViewProjection = cardsSource.slice(projectionStart, projectionEnd);

    expect(hookSource).toContain('calcularTotaisPorCartao(');
    expect(pageSource).toContain('allTransacoes={allProjectedCartaoTransacoes}');
    expect(cardViewProjection).toContain('projetarFaturasCartao({');
    expect(cardViewProjection).not.toContain("startsWith('Fatura ')");
    expect(cardViewProjection).not.toContain("includes('cartão')");
    expect(cashflowSource).toContain('calcularValorFaturaCartao({');
    expect(projectionSource).toContain('item.cartao_vencimento_id === cartao.id');
  });

  it('não reintroduz o módulo legado de visões financeiras sem consumidores', () => {
    const pageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

    expect(pageSource).not.toContain("@/components/finance-views");
    expect(existsSync(new URL('../components/finance-views.tsx', import.meta.url))).toBe(false);
  });
});
