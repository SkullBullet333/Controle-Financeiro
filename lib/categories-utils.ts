/**
 * Utilitário de Categorização Automática
 * Mapeia descrições para categorias baseadas em palavras-chave.
 */

const MAPPING: Record<string, string[]> = {
  'MERCADO': ['mercado', 'supermercado', 'feira', 'casa', 'limpeza', 'higiene', 'carrefour', 'extra', 'pão de açúcar', 'atacadão', 'hortifruti', 'muffato', 'condor'],
  'TRANSPORTE': ['uber', '99pop', 'combustível', 'gasolina', 'posto', 'estacionamento', 'pedágio', 'manutenção', 'carro', 'ipva', 'shell', 'ipiranga', 'petrobras'],
  'ALIMENTAÇÃO': ['restaurante', 'ifood', 'lanche', 'pizza', 'burger', 'café', 'cafeteria', 'padaria', 'almoço', 'janta', 'starbucks', 'mcdonalds', 'burger king', 'subway', 'outback'],
  'MORADIA': ['aluguel', 'condomínio', 'luz', 'energia', 'água', 'gás', 'internet', 'enel', 'sabesp', 'vivo', 'claro', 'oi', 'tim', 'copel', 'sanepar'],
  'SAÚDE': ['farmácia', 'drogasil', 'pague menos', 'médico', 'hospital', 'consulta', 'exame', 'dentista', 'plano de saúde', 'unimed', 'sulamérica', 'hapvida'],
  'LAZER': ['netflix', 'spotify', 'cinema', 'teatro', 'viagem', 'hotel', 'airbnb', 'show', 'bar', 'pub', 'games', 'steam', 'playstation', 'xbox', 'ingresso'],
  'EDUCAÇÃO': ['curso', 'mensalidade', 'escola', 'faculdade', 'livro', 'material escolar', 'udemy', 'alura', 'fgv'],
  'COMPRAS': ['amazon', 'mercado livre', 'magalu', 'casas bahia', 'vestuário', 'roupa', 'sapato', 'zara', 'reni', 'hering', 'shopee', 'shein'],
};

export function categorizar(descricao: string): string {
  if (!descricao) return 'OUTROS';

  const desc = descricao.toLowerCase();

  for (const [categoria, keywords] of Object.entries(MAPPING)) {
    if (keywords.some(k => desc.includes(k))) {
      return categoria;
    }
  }

  return 'OUTROS';
}
