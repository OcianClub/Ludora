import { apiFetch } from '@/src/services/api';

import type { ConviteConsultado, ResultadoConvite } from './types';
import { lerRespostaConvite as lerResposta } from './resposta';

async function requisitar(endpoint: string, options?: RequestInit) {
  try {
    return await apiFetch(endpoint, options);
  } catch {
    throw new Error(options?.method === 'POST'
      ? 'Não recebemos a confirmação do aceite. Confira sua conexão e consulte o convite novamente. Se ele já foi aceito, entre na sua conta para acessar o clube.'
      : 'Não conseguimos consultar o convite. Verifique sua conexão e tente novamente em instantes.');
  }
}

export async function consultarConvite(codigo: string): Promise<ConviteConsultado> {
  const resposta = await requisitar(`/convites/codigo/${encodeURIComponent(codigo)}`);
  const dados = await lerResposta<{ convite: ConviteConsultado }>(resposta);
  if (!dados.convite?.clube?.id || typeof dados.convite.possui_conta !== 'boolean' || !Array.isArray(dados.convite.categorias)) {
    throw new Error('Não conseguimos carregar os detalhes do convite. Tente consultar novamente.');
  }
  return dados.convite;
}

export async function aceitarConviteNovaConta(
  codigo: string,
  dados: { nome: string; senha: string },
): Promise<ResultadoConvite> {
  const resposta = await requisitar(
    `/convites/codigo/${encodeURIComponent(codigo)}/aceitar`,
    {
      method: 'POST',
      body: JSON.stringify(dados),
    },
  );

  return validarResultado(await lerResposta<ResultadoConvite>(resposta));
}

export async function aceitarConviteContaExistente(
  codigo: string,
): Promise<ResultadoConvite> {
  const resposta = await requisitar(
    `/convites/codigo/${encodeURIComponent(codigo)}/aceitar-existente`,
    { method: 'POST' },
  );

  return validarResultado(await lerResposta<ResultadoConvite>(resposta));
}

function validarResultado(dados: ResultadoConvite) {
  if (!dados.usuario?.id || typeof dados.usuario.nome !== 'string' || typeof dados.usuario.email !== 'string' ||
      !dados.clube?.id || typeof dados.clube.nome !== 'string' || !Array.isArray(dados.clube.categorias)) {
    throw new Error('Não conseguimos confirmar o aceite. Consulte o convite novamente; se ele já foi aceito, entre na sua conta.');
  }
  return dados;
}
