import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readComponent = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

describe('estados vazios financeiros', () => {
  it('não inventa uma série financeira quando a projeção está vazia', () => {
    const source = readComponent('dashboard.tsx');

    expect(source).not.toContain("{ monthName: 'Jan', receitas: 18000");
    expect(source).toContain('Ainda não há dados para este gráfico');
  });

  it('não cria cartões, limites ou dados de quitação fictícios', () => {
    const cardsSource = readComponent('cards-view.tsx');
    const dashboardSource = readComponent('dashboard.tsx');

    expect(cardsSource).not.toContain('limite: 10000');
    expect(cardsSource).toContain("? 'Não informado'");
    expect(cardsSource).not.toContain('nominalTotal: nominalTotal ||');
    expect(cardsSource).not.toContain('currentCardFatura * Math.max');
    expect(cardsSource).toContain('Nenhum cartão cadastrado');
    expect(dashboardSource).toContain('Nenhum cartão cadastrado');
  });

  it('não usa titulares ou finais de cartão pessoais como fallback visual', () => {
    const sources = [
      readComponent('dashboard.tsx'),
      readComponent('cards-view.tsx'),
      readComponent('settings-view.tsx')
    ].join('\n');

    expect(sources).not.toMatch(/defaultHolder|last4/);
  });

  it('não apresenta reserva de emergência fictícia', () => {
    const radarSource = readComponent('radar-view.tsx');

    expect(radarSource).not.toContain('6.4 meses de despesas cobertas');
    expect(radarSource).toContain('Não calculada: o app ainda não registra o saldo da reserva.');
  });
});
