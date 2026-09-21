export type ValorMonetario = number | string | null | undefined;

function normalizarTextoDecimal(value: number | string): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Valor monetário inválido.');
    const text = String(value);
    return /e/i.test(text) ? value.toFixed(20).replace(/0+$/, '').replace(/\.$/, '') : text;
  }

  let text = value.trim().replace(/\s+/g, '').replace(/^R\$/i, '');
  if (!text) return '0';

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    text = text.replace(groupingSeparator, '');
    if (decimalSeparator === ',') text = text.replace(',', '.');
  } else if (lastComma >= 0) {
    text = text.replace(',', '.');
  }

  return text;
}

export function paraCentavos(value: ValorMonetario): number {
  if (value === null || value === undefined || value === '') return 0;

  const normalized = normalizarTextoDecimal(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new Error('Valor monetário inválido.');

  const sign = match[1] === '-' ? -1 : 1;
  const integerPart = BigInt(match[2]);
  const fraction = match[3] || '';
  const firstTwoDigits = (fraction + '00').slice(0, 2);
  let absoluteCents = (integerPart * BigInt(100)) + BigInt(firstTwoDigits);

  // Regra única: metade ou mais arredonda para longe de zero.
  if (fraction.length > 2 && Number(fraction[2]) >= 5) absoluteCents += BigInt(1);

  if (absoluteCents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Valor monetário excede o limite seguro.');
  }

  if (absoluteCents === BigInt(0)) return 0;
  return sign * Number(absoluteCents);
}

export function normalizarDinheiro(value: ValorMonetario): number {
  return paraCentavos(value) / 100;
}

export function somarDinheiro(values: Iterable<ValorMonetario>): number {
  let totalCents = 0;
  for (const value of values) {
    totalCents += paraCentavos(value);
    if (!Number.isSafeInteger(totalCents)) {
      throw new Error('Soma monetária excede o limite seguro.');
    }
  }
  return totalCents / 100;
}

export function subtrairDinheiro(
  minuendo: ValorMonetario,
  subtraendo: ValorMonetario
): number {
  return somarDinheiro([minuendo, -normalizarDinheiro(subtraendo)]);
}

export function multiplicarDinheiro(value: ValorMonetario, multiplicador: number): number {
  if (!Number.isFinite(multiplicador)) throw new Error('Multiplicador monetário inválido.');

  if (Number.isInteger(multiplicador)) {
    const result = paraCentavos(value) * multiplicador;
    if (!Number.isSafeInteger(result)) throw new Error('Produto monetário excede o limite seguro.');
    return result / 100;
  }

  return normalizarDinheiro(normalizarDinheiro(value) * multiplicador);
}
