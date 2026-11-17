import type { Prisma } from '@prisma/client';
const formato = new Intl.DateTimeFormat('sv-SE', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
export function agoraPartida(agora = new Date()) { return formato.format(agora).replace(' ', 'T').slice(0,16); }
export function horarioPassado(data:string, horario:string|null, agora = new Date()) { const hora=/^([01]\d|2[0-3]):[0-5]\d$/.test(horario || '') ? horario : '23:59';return `${data.slice(0,10)}T${hora}` < agoraPartida(agora); }
export function filtroPartidasAtrasadas(agora = new Date()): Prisma.PartidaWhereInput {
  const [dia,hora] = agoraPartida(agora).split('T'), data = new Date(`${dia}T00:00:00Z`);
  return { status:{in:['AGENDADA','PREPARADA']}, OR:[{data:{lt:data}}, {data,horario:{lt:hora}}] };
}
