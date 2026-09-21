import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const section = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('resiliência dos formulários administrativos', () => {
  const modalSource = readSource('./modals.tsx');

  it.each([
    ['titular', 'export function TitularForm', 'export function CartaoForm'],
    ['cartão', 'export function CartaoForm', 'export function StyledDatePicker'],
    ['perfil', 'export function ProfileForm', "import { CardLogo }"]
  ])('mantém o formulário de %s aberto quando a gravação falha', (_name, start, end) => {
    const formSource = section(modalSource, start, end);

    expect(formSource).toContain('await onSubmit(');
    expect(formSource).toContain('setIsSubmitting(true)');
    expect(formSource).toContain('setSubmitError(');
    expect(formSource).toContain('role="alert"');
  });

  it('aguarda os comandos antes de fechar os modais da página e das definições', () => {
    const pageSource = readSource('../app/page.tsx');
    const settingsSource = readSource('./settings-view.tsx');

    expect(pageSource).toContain('await updateProfile(data);');
    expect(pageSource).toContain('await updateTitular(editingItem.id, data);');
    expect(pageSource).toContain('await updateCartao(editingItem.id, data);');
    expect(settingsSource).toContain('await onUpdateTitular(editingTitular.id, data);');
    expect(settingsSource).toContain('await onUpdateCartao(editingCartao.id, data);');
  });

  it('propaga falhas dos comandos e restaura uma edição otimista de cartão', () => {
    const hookSource = readSource('../hooks/use-finance.ts');
    const addTitular = section(hookSource, 'const addTitular = async', 'const deleteTitular = async');
    const addCartao = section(hookSource, 'const addCartao = async', 'const sendCartaoUpdate = async');
    const updateCartao = section(hookSource, 'const updateCartao = async', 'const deleteCartao = async');

    expect(addTitular).toContain('throw error;');
    expect(addCartao).toContain('throw error;');
    expect(updateCartao).toContain('const previousConfig = config;');
    expect(updateCartao).toContain('setConfig(previousConfig);');
    expect(updateCartao).toContain('throw error;');
  });

  it('usa uma única confirmação e mantém o aviso aberto quando a exclusão protegida falha', () => {
    const pageSource = readSource('../app/page.tsx');
    const settingsSource = readSource('./settings-view.tsx');
    const confirmModal = section(modalSource, 'export function ConfirmModal', 'export function ProfileForm');

    expect(settingsSource).not.toContain('confirm(`Deseja realmente excluir o titular');
    expect(settingsSource).not.toContain('confirm(`Deseja realmente excluir o cartão');
    expect(pageSource).toContain("else if (type === 'titular') await deleteTitular(id);");
    expect(pageSource).toContain("else if (type === 'cartao') await deleteCartao(id);");
    expect(confirmModal).toContain('catch {');
    expect(confirmModal).toContain('setSubmitError(failureMessage);');
    expect(confirmModal).toContain('role="alert"');
  });

  it('mostra as configurações compartilhadas em modo somente leitura para membros', () => {
    const settingsSource = readSource('./settings-view.tsx');

    expect(settingsSource).toContain("const canManageSharedSettings = userType === 'titular';");
    expect(settingsSource).toContain('{canManageSharedSettings && (');
    expect(settingsSource).toContain("? 'Nenhum titular cadastrado ainda. Clique em \"Novo Titular\" para adicionar.'");
    expect(settingsSource).toContain("? 'Nenhum cartão de crédito cadastrado ainda. Clique em \"Novo Cartão\" para adicionar.'");
    expect(settingsSource).toContain("onClick={canManageSharedSettings ? () => {");
  });
});
