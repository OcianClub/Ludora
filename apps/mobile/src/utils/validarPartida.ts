export function dataPartidaISO(
  data: string,
  ano = new Date().getFullYear()
): string | null {
  if (!/^\d{2}\/\d{2}(\/\d{4})?$/.test(data)) return null;
  const [dia, mes, anoInformado] = data.split('/').map(Number);
  ano = anoInformado ?? ano;
  if (!Number.isSafeInteger(ano) || ano < 1900 || ano > 9998) return null;
  const valor = new Date(ano, mes - 1, dia);
  if (
    valor.getFullYear() !== ano ||
    valor.getMonth() !== mes - 1 ||
    valor.getDate() !== dia
  )
    return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function horarioPartidaValido(horario: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(horario);
}

export function erroFormularioPartida(dados: {
  mandanteId?: number;
  visitanteId?: number;
  categoriaId: number | null;
  data: string;
  horario: string;
}): string | null {
  if (!dados.categoriaId) return 'Selecione uma categoria.';
  if (!dados.mandanteId || !dados.visitanteId)
    return 'Selecione os dois times do confronto.';
  if (dados.mandanteId === dados.visitanteId)
    return 'Mandante e visitante precisam ser times diferentes.';
  if (!dataPartidaISO(dados.data))
    return 'Informe uma data válida no formato DD/MM.';
  if (!horarioPartidaValido(dados.horario))
    return 'Informe um horário válido entre 00:00 e 23:59.';
  return null;
}
