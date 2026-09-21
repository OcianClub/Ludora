import { apiFetch } from '@/src/services/api';

import type { ConviteConsultado, ResultadoConvite } from './types';

async function lerResposta<T>(resposta: Response): Promise<T> {
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.error || 'Não foi possível concluir a operação.');
  }

  return dados as T;
}

export async function consultarConvite(codigo: string): Promise<ConviteConsultado> {
  const resposta = await apiFetch(`/convites/codigo/${encodeURIComponent(codigo)}`);
  const dados = await lerResposta<{ convite: ConviteConsultado }>(resposta);
  return dados.convite;
}

export async function aceitarConviteNovaConta(
  codigo: string,
  dados: { nome: string; senha: string },
): Promise<ResultadoConvite> {
  const resposta = await apiFetch(
    `/convites/codigo/${encodeURIComponent(codigo)}/aceitar`,
    {
      method: 'POST',
      body: JSON.stringify(dados),
    },
  );

  return lerResposta<ResultadoConvite>(resposta);
}

export async function aceitarConviteContaExistente(
  codigo: string,
): Promise<ResultadoConvite> {
  const resposta = await apiFetch(
    `/convites/codigo/${encodeURIComponent(codigo)}/aceitar-existente`,
    { method: 'POST' },
  );

  return lerResposta<ResultadoConvite>(resposta);
}
