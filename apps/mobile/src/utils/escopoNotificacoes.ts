export function headersClubeNotificacoes(clubeId: number) {
  if (!Number.isSafeInteger(clubeId) || clubeId <= 0) {
    throw new Error('Selecione um clube válido para consultar seus avisos.');
  }
  return { 'x-clube-id': String(clubeId) };
}

export function criarEscopoNotificacoes() {
  let clubeId: number | null = null;
  let versao = 0;
  let ocupado = false;
  return {
    capturar() {
      const atual = versao;
      return { atual: () => atual === versao && clubeId !== null };
    },
    definirClube(id: number | null) {
      if (id === clubeId) return;
      clubeId = id;
      versao += 1;
      ocupado = false;
    },
    iniciar() {
      if (!clubeId || ocupado) return null;
      ocupado = true;
      const atual = versao;
      let concluida = false;
      return {
        clubeId,
        atual: () => !concluida && atual === versao,
        concluir() {
          if (concluida || atual !== versao) return false;
          concluida = true;
          ocupado = false;
          return true;
        },
      };
    },
  };
}
