// Datas de jogos são dias de calendário; os horários seguem o horário de Brasília.
const formato = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
export function agoraPartida(agora = new Date()) { return formato.format(agora).replace(' ', 'T').slice(0,16); }
export function partidaAtrasada(p: { status:string; data:string; horario?:string|null }, agora = new Date()) {
  if (!['AGENDADA','PREPARADA'].includes(p.status)) return false;
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(p.horario || '') ? p.horario! : '23:59';
  return `${p.data.slice(0,10)}T${hora}` < agoraPartida(agora);
}
export function horarioPassado(data:string, horario:string, agora = new Date()) { return `${data}T${horario}` < agoraPartida(agora); }
