// Regras de temporada independentes de React, HTTP e banco de dados.
export function anoTemporada(agora = new Date()): number {
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(agora));
}

export function categoriaPorNascimento(valor: string, agora = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Data de nascimento inválida');
  const data = new Date(`${valor}T00:00:00.000Z`);
  const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(agora);
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== valor || valor > hoje) {
    throw new Error('Data de nascimento inválida ou futura');
  }
  const idade = anoTemporada(agora) - Number(valor.slice(0, 4));
  if (idade < 4) return null;
  const limite = [7, 8, 9, 10, 12, 14, 16, 18].find(limite => idade <= limite);
  return limite === undefined ? null : `sub-${limite}`;
}

type Aluno = { id: number; dtNasc: Date; categoria_id: number; numCamisa: number | null; ativo: boolean };
type Categoria = { id: number; nome: string };
export function planejarTemporada(alunos: Aluno[], categorias: Categoria[], agora = new Date()) {
  const planos = alunos.filter(a => a.ativo).map(aluno => {
    const nome = categoriaPorNascimento(aluno.dtNasc.toISOString().slice(0, 10), agora);
    const destino = nome ? categorias.find(c => c.nome.toLowerCase() === nome) : null;
    if (nome && !destino) throw new Error(`Categoria ${nome} não cadastrada no clube`);
    return { aluno, destino: destino?.id ?? null };
  });
  // Quem permanece na categoria tem prioridade. Entre transferidos, menor ID primeiro.
  planos.sort((a, b) => Number(a.destino !== a.aluno.categoria_id) - Number(b.destino !== b.aluno.categoria_id) || a.aluno.id - b.aluno.id);
  const ocupadas = new Set<string>();
  return planos.map(({ aluno, destino }) => {
    let camisa = aluno.numCamisa;
    if (destino !== null && camisa !== null) {
      const chave = `${destino}:${camisa}`;
      if (ocupadas.has(chave)) camisa = null;
      else ocupadas.add(chave);
    }
    return { id: aluno.id, categoria_id: destino ?? aluno.categoria_id, ativo: destino !== null, numCamisa: camisa,
      alterado: destino === null || destino !== aluno.categoria_id || camisa !== aluno.numCamisa };
  });
}
