import { dataPartidaISO, horarioPartidaValido } from './validarPartida';

export type CategoriaPartida = {
  id: number;
  nome: string;
  tipo: 'INICIACAO' | 'BASE';
};
export type TimePartida = {
  id: number;
  nome: string;
  escudo: string | null;
  categoria_id: number;
};
export type CompeticaoPartida = { id: number; nome: string; ano: number };
export type CamposPartida = {
  categoriaId: number | null;
  competicao: CompeticaoPartida | null | undefined;
  mandante: TimePartida | null;
  visitante: TimePartida | null;
  data: string;
  horario: string;
  local: string;
  emCasa: boolean;
};
export type CampoPartida =
  | 'categoria'
  | 'competicao'
  | 'confronto'
  | 'data'
  | 'horario'
  | 'local';

export function mascaraDataPartida(texto: string) {
  const numeros = texto.replace(/\D/g, '').slice(0, 8);
  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 4) return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
}

export function mascaraHorarioPartida(texto: string) {
  const numeros = texto.replace(/\D/g, '').slice(0, 4);
  return numeros.length > 2
    ? `${numeros.slice(0, 2)}:${numeros.slice(2)}`
    : numeros;
}

export function dataPartidaTexto(data: Date) {
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
}

export function errosOrganizarPartida(campos: CamposPartida) {
  const erros: Partial<Record<CampoPartida, string>> = {};
  if (!campos.categoriaId)
    erros.categoria = 'Selecione a categoria da partida.';
  if (campos.competicao === undefined)
    erros.competicao = 'Escolha uma competição ou a opção amistoso.';
  if (!campos.mandante || !campos.visitante)
    erros.confronto = 'Selecione o mandante e o visitante.';
  else if (campos.mandante.id === campos.visitante.id)
    erros.confronto = 'Escolha dois times diferentes.';
  else if (
    campos.mandante.categoria_id !== campos.categoriaId ||
    campos.visitante.categoria_id !== campos.categoriaId
  )
    erros.confronto =
      'Os dois times precisam pertencer à categoria selecionada.';
  if (
    !/^\d{2}\/\d{2}\/\d{4}$/.test(campos.data) ||
    !dataPartidaISO(campos.data)
  )
    erros.data = 'Informe uma data válida: DD/MM/AAAA.';
  if (!horarioPartidaValido(campos.horario))
    erros.horario = 'Use um horário entre 00:00 e 23:59.';
  if (campos.local.trim().length > 160)
    erros.local = 'Use até 160 caracteres para o local.';
  return erros;
}

export function rascunhoPartidaAlterado(
  campos: CamposPartida,
  categoriaInicial: number | null
) {
  return (
    campos.categoriaId !== categoriaInicial ||
    campos.competicao !== undefined ||
    !!campos.mandante ||
    !!campos.visitante ||
    !!campos.data ||
    !!campos.horario ||
    !!campos.local.trim() ||
    !campos.emCasa
  );
}

export function diasCalendarioPartida(ano: number, mes: number) {
  const primeiro = new Date(ano, mes, 1).getDay();
  const quantidade = new Date(ano, mes + 1, 0).getDate();
  return Array.from(
    { length: Math.ceil((primeiro + quantidade) / 7) * 7 },
    (_, indice) => {
      const dia = indice - primeiro + 1;
      return dia >= 1 && dia <= quantidade ? dia : null;
    }
  );
}

export function normalizarBuscaPartida(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
