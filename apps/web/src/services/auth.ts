import { BASE_URL } from './config';
import { AuthError, authRequest } from './authHttp';
import { caminhoConvite, normalizarCodigo, normalizarEmail } from '../utils/authValidation';
import type { Clube, Usuario } from './api';

function enviar<T>(endpoint: string, dados: object, token?: string) {
  return authRequest<T>(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(dados),
  }, 20_000, endpoint === '/auth/registrar' || endpoint === '/auth/redefinir-senha' || endpoint.endsWith('/aceitar') || endpoint.endsWith('/aceitar-existente'));
}

export async function solicitarCodigoCadastro(email: string) {
  const resultado = await enviar<{ cadastro_id: string }>(
    '/auth/cadastro/solicitar-codigo', { email: normalizarEmail(email) },
  );
  if (!/^[a-f0-9]{64}$/.test(resultado.cadastro_id)) {
    throw new AuthError('Não conseguimos confirmar o envio do código. Tente novamente.');
  }
  return resultado.cadastro_id;
}

export function cadastrar(dados: { nome: string; email: string; senha: string; codigo: string; cadastro_id: string }) {
  return enviar<{ mensagem: string }>('/auth/registrar', {
    ...dados,
    nome: dados.nome.trim(),
    email: normalizarEmail(dados.email),
    codigo: normalizarCodigo(dados.codigo),
  });
}

export function solicitarCodigoSenha(email: string) {
  return enviar<{ mensagem: string }>('/auth/recuperar-senha', { email: normalizarEmail(email) });
}

export function redefinirSenha(email: string, codigo: string, senha: string) {
  return enviar<{ mensagem: string }>('/auth/redefinir-senha', {
    email: normalizarEmail(email), codigo: normalizarCodigo(codigo), senha,
  });
}

export type Convite = {
  id: string;
  email: string;
  possui_conta: boolean;
  papel: string;
  acesso_todas_categorias: boolean;
  expira_em: string;
  clube: Clube;
  convidado_por: string;
  categorias: { id: number; nome: string }[];
};

export type ResultadoConvite = {
  token?: string;
  usuario: Usuario;
  clube: Clube & { papel: string; acesso_todas_categorias: boolean; categorias: { id: number; nome: string }[] };
};

function endpointConvite(credencial: string, token: boolean) {
  const endpoint = caminhoConvite(credencial, token);
  if (!endpoint) throw new AuthError('Digite os 8 caracteres do convite recebido por e-mail.');
  return endpoint;
}

export async function consultarConvite(credencial: string, token = false) {
  const resultado = await authRequest<{ convite: Convite }>(
    `${BASE_URL}${endpointConvite(credencial, token)}`,
  );
  if (!resultado.convite?.clube?.id ||
      typeof resultado.convite.clube.nome !== 'string' ||
      typeof resultado.convite.possui_conta !== 'boolean' ||
      !Array.isArray(resultado.convite.categorias)) {
    throw new AuthError('Não conseguimos confirmar os dados do convite. Tente novamente.');
  }
  return resultado.convite;
}

export function aceitarConvite(credencial: string, porToken: boolean, dados: { nome: string; senha: string }) {
  return enviar<ResultadoConvite>(`${endpointConvite(credencial, porToken)}/aceitar`, dados);
}

export function aceitarConviteExistente(credencial: string, porToken: boolean, token: string) {
  return enviar<ResultadoConvite>(`${endpointConvite(credencial, porToken)}/aceitar-existente`, {}, token);
}
