import { beforeEach, describe, expect, it, vi } from 'vitest';
const { from, rpc, responses } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  responses: [] as Array<{ error: unknown }>,
}));

vi.mock('./supabase', () => ({ supabase: { from, rpc } }));

import { atualizarCategoriaPorDescricao, renomearCategoriaEmLote } from './finance-service';

function query() {
  const builder = {
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    then: (resolve: (value: { error: unknown }) => unknown) => resolve(responses.shift() ?? { error: null }),
  };
  return builder;
}

describe('falhas em alterações de categorias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses.length = 0;
    from.mockImplementation(() => query());
    rpc.mockResolvedValue({ error: { code: 'PGRST202' } });
  });

  it('usa uma única RPC quando o schema local está atualizado', async () => {
    rpc.mockResolvedValue({ error: null });
    await expect(renomearCategoriaEmLote(' Antiga ', ' Nova ', 'familia')).resolves.toEqual({ success: true });
    await expect(atualizarCategoriaPorDescricao('Compra', 'Nova', 'familia')).resolves.toEqual({ success: true });
    expect(rpc).toHaveBeenNthCalledWith(1, 'renomear_categoria_em_lote', {
      p_categoria_antiga: 'Antiga', p_categoria_nova: 'Nova',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'atualizar_categoria_por_descricao', {
      p_descricao: 'Compra', p_categoria_nova: 'Nova',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('não executa gravações parciais quando a RPC falha por permissão', async () => {
    const error = { code: '42501' };
    rpc.mockResolvedValue({ error });
    await expect(renomearCategoriaEmLote('Antiga', 'Nova', 'familia')).rejects.toBe(error);
    expect(from).not.toHaveBeenCalled();
  });

  it('não declara sucesso após falha em uma das tabelas', async () => {
    const error = { code: '23514' };
    responses.push({ error: null }, { error });

    await expect(renomearCategoriaEmLote('Antiga', 'Nova', 'familia')).rejects.toBe(error);
    expect(from.mock.calls.map(([table]) => table)).toEqual(['despesas', 'contas_fixas']);
  });

  it('detecta falha de cartão na reclassificação por descrição', async () => {
    const error = { code: '42501' };
    responses.push({ error: null }, { error: null }, { error });

    await expect(atualizarCategoriaPorDescricao('Compra', 'Nova', 'familia')).rejects.toBe(error);
    expect(from.mock.calls.map(([table]) => table)).toEqual(['despesas', 'contas_fixas', 'cartoes']);
  });

  it('não consulta uma coluna descricao inexistente em cartoes', async () => {
    await expect(atualizarCategoriaPorDescricao('Compra', 'Nova', 'familia')).resolves.toEqual({ success: true });
    expect(from.mock.calls.map(([table]) => table)).toEqual(['despesas', 'contas_fixas', 'cartoes']);
  });
});
