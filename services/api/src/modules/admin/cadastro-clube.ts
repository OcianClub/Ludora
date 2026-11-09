import { Prisma } from '@prisma/client';
import { lerEndereco } from '../clubes/endereco';
import { SUBS_PADRAO } from './admin.rules';

export function lerCnpj(valor: unknown) {
  if (typeof valor !== 'string' || !/^[0-9./\-\s]+$/.test(valor)) throw new Error('Informe o CNPJ de 14 dígitos.');
  const cnpj = valor.replace(/\D/g, '');
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) throw new Error('CNPJ inválido.');
  const digito = (parte: string) => {
    const total = [...parte].reduce((soma, n, i) => soma + Number(n) * (2 + (parte.length - 1 - i) % 8), 0);
    const resto = total % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (digito(cnpj.slice(0, 12)) !== Number(cnpj[12]) || digito(cnpj.slice(0, 13)) !== Number(cnpj[13])) throw new Error('Os dígitos verificadores do CNPJ não conferem.');
  return cnpj;
}

export function lerEnderecoCadastro(entrada: unknown) {
  const endereco = lerEndereco(entrada);
  if (!endereco?.numero || !endereco.bairro) throw new Error('Informe CEP, logradouro, número, bairro, cidade e UF.');
  const cep = (entrada as { cep?: unknown }).cep;
  if (typeof cep !== 'string' || !/^\d{5}-?\d{3}$/.test(cep.trim())) throw new Error('Informe um CEP válido de oito dígitos.');
  return endereco;
}

export function lerEscudo(entrada: unknown) {
  if (entrada == null) return null;
  const match = typeof entrada === 'string' && entrada.length <= 90000 && /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(entrada);
  if (!match) throw new Error('Escolha um arquivo PNG, JPEG ou WebP de até 64 KB.');
  const [, tipo, dados] = match;
  const bytes = Buffer.from(dados, 'base64');
  const valido = bytes.length <= 65536 && bytes.toString('base64') === dados && (
    tipo === 'png' && bytes.length >= 33 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(16) <= 1024 && bytes.readUInt32BE(20) > 0 && bytes.readUInt32BE(20) <= 1024 ||
    tipo === 'jpeg' && bytes.length > 4 && bytes.subarray(0, 3).toString('hex') === 'ffd8ff' && bytes.subarray(-2).toString('hex') === 'ffd9' ||
    tipo === 'webp' && bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) === bytes.length - 8
  );
  if (!valido) throw new Error('O escudo não corresponde ao formato da imagem ou excede o limite.');
  return `data:image/${tipo};base64,${dados}`;
}

export function lerSubs(valor: unknown): number[] {
  if (!Array.isArray(valor) || valor.length > SUBS_PADRAO.length || valor.some(idade => !SUBS_PADRAO.some(sub => sub === idade))) throw new Error('Escolha apenas os SUBs sugeridos.');
  return [...new Set(valor)];
}

export async function dependenciasCategoria(tx: Prisma.TransactionClient, clubeId: number, id: number) {
  const cat = await tx.categoria.findFirst({ where: { id, clube_id: clubeId }, include: { _count: { select: {
    jogadores: true, partidas: true, times: true, competicoes: true, usuariosPermitidos: true, convites: true, equipesPartida: true,
  } } } });
  if (!cat) return null;
  const propostas = await tx.propostaPartida.count({ where: { OR: [{ categoria_origem_id: id }, { categoria_destino_id: id }] } });
  const federal = await tx.fpfsVinculo.count({ where: { clubeId, equipe: { times: { some: { evento: { categoria: { equals: `sub-${cat.faixaIdade}`, mode: 'insensitive' } } } } } } });
  const c = cat._count;
  return { jogadores: c.jogadores, partidas: c.partidas + c.equipesPartida, times: c.times, competições: c.competicoes,
    permissões: c.usuariosPermitidos, convites: c.convites, propostas, 'vínculos oficiais': federal };
}
