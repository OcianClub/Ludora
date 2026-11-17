import assert from 'node:assert/strict';
import {test} from 'node:test';
import {partidaAtrasada,horarioPassado,agoraPartida} from '../../../packages/shared-types/src/matchSchedule.ts';
test('web e mobile calculam atraso no horário de Brasília preservando status encerrados',()=>{
  const agora=new Date('2026-11-17T00:47:30Z');
  assert.equal(agoraPartida(agora),'2026-11-16T21:47');
  assert.equal(horarioPassado('2026-11-16','21:46',agora),true);
  assert.equal(horarioPassado('2026-11-16','21:47',agora),false);
  for(const status of ['AGENDADA','PREPARADA'])assert.equal(partidaAtrasada({status,data:'2026-11-16',horario:'21:46'},agora),true);
  for(const status of ['AO_VIVO','FINALIZADA','CANCELADA'])assert.equal(partidaAtrasada({status,data:'2026-11-15',horario:'20:00'},agora),false);
  assert.equal(partidaAtrasada({status:'AGENDADA',data:'2026-11-16',horario:null},agora),false);
});
