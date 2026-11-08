import type { Prisma, Categoria } from '@prisma/client';
export function escopoPartidas(clubeId: number): Prisma.PartidaWhereInput {
  return { OR: [{categoria:{clube_id:clubeId}}, {mandante:{clube_representado_id:clubeId}}, {visitante:{clube_representado_id:clubeId}}, {participantes:{some:{clube_id:clubeId}}}] };
}

// A categoria pertence a cada clube, mesmo quando a partida é um único registro.
// O fallback é somente para partidas antigas, anteriores aos participantes.
export function escopoCategoriaPartidas(clubeId: number, categoria: Pick<Categoria, 'id' | 'nome' | 'tipo' | 'faixaIdade'>): Prisma.PartidaWhereInput {
  return { OR: [
    { categoria_id: categoria.id },
    { participantes: { some: { clube_id: clubeId, categoria_id: categoria.id } } },
    { participantes: { none: { clube_id: clubeId } }, categoria: {
      tipo: categoria.tipo,
      OR: [{ nome: { equals: categoria.nome, mode: 'insensitive' } }, ...(categoria.faixaIdade > 0 ? [{ faixaIdade: categoria.faixaIdade }] : [])],
    } },
  ] };
}
type TimeRepresentado = {id?:number;clube_representado_id:number|null; clubeRepresentado?:{nome:string;escudo:string|null}|null};
function identidadeDoClube<T extends TimeRepresentado>(time:T) {
  return time.clubeRepresentado ? {...time,nome:time.clubeRepresentado.nome,escudo:time.clubeRepresentado.escudo} : time;
}
export function perspectivaPartida<T extends { categoria:{id:number;clube_id:number}; emCasa:boolean; mandante:TimeRepresentado; visitante:TimeRepresentado; participantes?: { clube_id: number; time_id?:number; categoria: {id:number;nome:string;tipo:string;clube_id:number} }[] }>(partida:T, clubeId:number) {
  const propria = partida.categoria.clube_id === clubeId;
  const equipe = partida.participantes?.find(e => e.clube_id === clubeId);
  const categoria = equipe?.categoria || partida.categoria;
  return {...partida, categoria, categoria_id: categoria.id, mandante:identidadeDoClube(partida.mandante), visitante:identidadeDoClube(partida.visitante), clube_origem_id:partida.categoria.clube_id, somente_leitura:!propria,
    emCasa: equipe?.time_id != null ? equipe.time_id === partida.mandante.id : propria ? partida.emCasa : partida.mandante.clube_representado_id === clubeId};
}
