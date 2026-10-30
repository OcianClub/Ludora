import type { Prisma } from '@prisma/client';
export function escopoPartidas(clubeId: number): Prisma.PartidaWhereInput {
  return { OR: [{categoria:{clube_id:clubeId}}, {mandante:{clube_representado_id:clubeId}}, {visitante:{clube_representado_id:clubeId}}] };
}
type TimeRepresentado = {clube_representado_id:number|null; clubeRepresentado?:{nome:string;escudo:string|null}|null};
function identidadeDoClube<T extends TimeRepresentado>(time:T) {
  return time.clubeRepresentado ? {...time,nome:time.clubeRepresentado.nome,escudo:time.clubeRepresentado.escudo} : time;
}
export function perspectivaPartida<T extends { categoria:{clube_id:number}; emCasa:boolean; mandante:TimeRepresentado; visitante:TimeRepresentado; participantes?: { clube_id: number; categoria: {id:number;nome:string;tipo:string;clube_id:number} }[] }>(partida:T, clubeId:number) {
  const propria = partida.categoria.clube_id === clubeId;
  return {...partida, categoria: partida.participantes?.find(e => e.clube_id === clubeId)?.categoria || partida.categoria, mandante:identidadeDoClube(partida.mandante), visitante:identidadeDoClube(partida.visitante), clube_origem_id:partida.categoria.clube_id, somente_leitura:!propria,
    emCasa: propria ? partida.emCasa : partida.mandante.clube_representado_id === clubeId};
}
