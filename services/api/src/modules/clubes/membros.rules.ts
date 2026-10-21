export const PAPEIS_ATRIBUIVEIS = ['TORCEDOR', 'OLHEIRO', 'TECNICO', 'MESARIO', 'ADMIN'] as const;
export function validarCargo(body: any) {
  if (!PAPEIS_ATRIBUIVEIS.includes(body?.papel)) throw new Error('Cargo inválido');
  const papel = body.papel as typeof PAPEIS_ATRIBUIVEIS[number];
  const leitura = papel === 'TORCEDOR' || papel === 'OLHEIRO';
  const acessoTotal = papel === 'ADMIN' || (!leitura && body.acesso_todas_categorias === true);
  const ids = body.categoria_ids ?? [];
  if (!Array.isArray(ids) || ids.length > 30 || ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) throw new Error('Categorias inválidas');
  if (!leitura && !acessoTotal && !ids.length) throw new Error('Selecione ao menos uma categoria');
  return { papel, acessoTotal, ids: leitura || acessoTotal ? [] : ids as number[] };
}
