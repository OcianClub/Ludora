import cron from 'node-cron';

import { sincronizarTodos } from '../services/campeonato.service';

let sincronizacaoEmAndamento: Promise<void> | null = null;

export function executarSincronizacao(): Promise<void> {
  if (sincronizacaoEmAndamento) return sincronizacaoEmAndamento;

  sincronizacaoEmAndamento = sincronizarTodos().finally(() => {
    sincronizacaoEmAndamento = null;
  });

  return sincronizacaoEmAndamento;
}

export function iniciarSincronizacaoCampeonatos() {
  executarSincronizacao().catch(error => {
    console.error('Erro na sincronização inicial:', error?.message || error);
  });

  cron.schedule('*/30 * * * *', () => {
    executarSincronizacao().catch(error => {
      console.error('Erro na sincronização agendada:', error?.message || error);
    });
  });
}
