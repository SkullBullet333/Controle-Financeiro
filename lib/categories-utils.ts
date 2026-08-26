/**
 * Utilitário de Categorização Automática
 * Mapeia descrições para categorias baseadas em palavras-chave.
 */

const MAPPING: Record<string, string[]> = {
  'Mercado': ['mercado', 'supermercado', 'feira', 'casa', 'limpeza', 'higiene', 'carrefour', 'extra', 'pão de açúcar', 'atacadão', 'hortifruti', 'muffato', 'condor'],
  'Transporte': ['uber', '99pop', 'combustível', 'gasolina', 'posto', 'estacionamento', 'pedágio', 'manutenção', 'carro', 'ipva', 'shell', 'ipiranga', 'petrobras'],
  'Alimentação': ['restaurante', 'ifood', 'lanche', 'pizza', 'burger', 'café', 'cafeteria', 'padaria', 'almoço', 'janta', 'starbucks', 'mcdonalds', 'burger king', 'subway', 'outback'],
  'Moradia': ['aluguel', 'condomínio', 'luz', 'energia', 'água', 'gás', 'internet', 'enel', 'sabesp', 'vivo', 'claro', 'oi', 'tim', 'copel', 'sanepar'],
  'Saúde': ['farmácia', 'drogasil', 'pague menos', 'médico', 'hospital', 'consulta', 'exame', 'dentista', 'plano de saúde', 'unimed', 'sulamérica', 'hapvida'],
  'Lazer': ['netflix', 'spotify', 'cinema', 'teatro', 'viagem', 'hotel', 'airbnb', 'show', 'bar', 'pub', 'games', 'steam', 'playstation', 'xbox', 'ingresso'],
  'Educação': ['curso', 'mensalidade', 'escola', 'faculdade', 'livro', 'material escolar', 'udemy', 'alura', 'fgv'],
  'Compras': ['amazon', 'mercado livre', 'magalu', 'casas bahia', 'vestuário', 'roupa', 'sapato', 'zara', 'reni', 'hering', 'shopee', 'shein'],
};

export function categorizar(descricao: string): string {
  if (!descricao) return 'Outros';

  const desc = descricao.toLowerCase();

  for (const [categoria, keywords] of Object.entries(MAPPING)) {
    if (keywords.some(k => desc.includes(k))) {
      return categoria;
    }
  }

  return 'Outros';
}
