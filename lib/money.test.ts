import { describe, expect, it } from 'vitest';
import {
  multiplicarDinheiro,
  normalizarDinheiro,
  paraCentavos,
  somarDinheiro,
  subtrairDinheiro,
} from './money';

describe('dinheiro em centavos', () => {
  it('soma valores decimais sem resíduos binários', () => {
    expect(somarDinheiro([0.1, 0.2])).toBe(0.3);
    expect(somarDinheiro([0.1, 0.2, -0.05])).toBe(0.25);
  });

  it('arredonda metade para longe de zero', () => {
    expect(normalizarDinheiro(10.075)).toBe(10.08);
    expect(normalizarDinheiro(-10.075)).toBe(-10.08);
    expect(paraCentavos('1,005')).toBe(101);
    expect(Object.is(normalizarDinheiro(-0.004), -0)).toBe(false);
  });

  it('aceita formatos decimais usados na interface brasileira', () => {
    expect(normalizarDinheiro('R$ 1.234,56')).toBe(1234.56);
    expect(normalizarDinheiro('1234.56')).toBe(1234.56);
  });

  it('subtrai e multiplica preservando centavos', () => {
    expect(subtrairDinheiro(0.3, 0.1)).toBe(0.2);
    expect(multiplicarDinheiro(19.99, 3)).toBe(59.97);
  });

  it('recusa entradas inválidas ou fora do limite seguro', () => {
    expect(() => paraCentavos('dez')).toThrow('Valor monetário inválido.');
    expect(() => paraCentavos(Number.POSITIVE_INFINITY)).toThrow('Valor monetário inválido.');
    expect(() => paraCentavos('999999999999999')).toThrow('limite seguro');
  });
});
