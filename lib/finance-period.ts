export interface PaginatedResult<T> {
  data: T[] | null;
  error: { message?: string } | null;
}

export function criarJanelaCompetencias(
  mesInicial: number,
  anoInicial: number,
  quantidade = 6
): string[] {
  if (!Number.isInteger(mesInicial) || mesInicial < 1 || mesInicial > 12) {
    throw new Error('Mês inicial inválido.');
  }
  if (!Number.isInteger(anoInicial) || anoInicial < 1) {
    throw new Error('Ano inicial inválido.');
  }
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new Error('Quantidade de competências inválida.');
  }

  return Array.from({ length: quantidade }, (_, index) => {
    const absoluteMonth = (anoInicial * 12) + (mesInicial - 1) + index;
    const year = Math.floor(absoluteMonth / 12);
    const month = (absoluteMonth % 12) + 1;
    return `${String(month).padStart(2, '0')}/${year}`;
  });
}

export function chaveJanelaFinanceira(competencias: string[]): string {
  if (competencias.length === 0) throw new Error('A janela financeira não pode ser vazia.');
  return `${competencias[0]}_${competencias[competencias.length - 1]}`.replaceAll('/', '-');
}

export function deveAbrirProximoMesQuandoQuitado(
  mesSelecionado: number,
  anoSelecionado: number,
  despesasDoMes: readonly { status: string }[],
  agora = new Date()
): boolean {
  const correspondeAoMesAtual = mesSelecionado === agora.getMonth() + 1
    && anoSelecionado === agora.getFullYear();

  return correspondeAoMesAtual
    && despesasDoMes.length > 0
    && despesasDoMes.every(item => item.status === 'Pago');
}

export async function carregarTodasPaginas<T>(
  buscarPagina: (inicio: number, fim: number) => PromiseLike<PaginatedResult<T>>,
  tamanhoPagina = 500
): Promise<T[]> {
  if (!Number.isInteger(tamanhoPagina) || tamanhoPagina < 1) {
    throw new Error('Tamanho de página inválido.');
  }

  const registros: T[] = [];

  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const resultado = await buscarPagina(inicio, inicio + tamanhoPagina - 1);
    if (resultado.error) {
      throw new Error(resultado.error.message || 'Falha ao carregar uma página financeira.');
    }

    const pagina = resultado.data || [];
    registros.push(...pagina);

    if (pagina.length < tamanhoPagina) return registros;
  }
}
