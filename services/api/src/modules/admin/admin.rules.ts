import { EventEmitter } from 'node:events';

// ─── Super Admin ──────────────────────────────────────────────────────────────
// Não existe papel de plataforma no banco (os papéis são por clube). A lista de
// Super Admins vem do ambiente, o que evita migration no banco compartilhado.
// O e-mail só chega aqui depois de confirmado por código (ver cadastro.routes).

export function parseSuperAdmins(raw: string | undefined): Set<string> {
  return new Set(
    String(raw || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 3 && email.includes('@'))
  );
}

export function ehSuperAdmin(email: string | null | undefined, lista: Set<string>): boolean {
  return !!email && lista.has(email.trim().toLowerCase());
}

// ─── Validações ───────────────────────────────────────────────────────────────

export const PLANOS_VALIDOS = ['FREE', 'DEMO', 'TRIAL', 'PRO'] as const;
export type PlanoClube = (typeof PLANOS_VALIDOS)[number];

export const SUBS_PADRAO = [7, 8, 9, 10, 12, 14, 16, 18] as const;

function textoOpcional(valor: unknown, max: number, campo: string): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  const texto = String(valor).trim();
  if (texto.length > max) throw new Error(`${campo} muito longo`);
  return texto || null;
}

export interface DadosClube {
  nome?: string;
  cidade?: string | null;
  estado?: string | null;
  plano?: PlanoClube;
  escudo?: string | null;
}

export function validarClube(body: any, { criando }: { criando: boolean }): DadosClube {
  const dados: DadosClube = {};

  if (body?.nome !== undefined || criando) {
    const nome = String(body?.nome ?? '').trim();
    if (nome.length < 2 || nome.length > 80) throw new Error('Nome do clube deve ter de 2 a 80 caracteres');
    dados.nome = nome;
  }

  const cidade = textoOpcional(body?.cidade, 80, 'Cidade');
  if (cidade !== undefined) dados.cidade = cidade;

  const estado = textoOpcional(body?.estado, 2, 'Estado');
  if (estado !== undefined) {
    if (estado !== null && !/^[A-Za-z]{2}$/.test(estado)) throw new Error('Estado deve ter 2 letras (UF)');
    dados.estado = estado ? estado.toUpperCase() : null;
  }

  if (body?.plano !== undefined) {
    if (!PLANOS_VALIDOS.includes(body.plano)) throw new Error(`Plano inválido. Use: ${PLANOS_VALIDOS.join(', ')}`);
    dados.plano = body.plano;
  }

  const escudo = textoOpcional(body?.escudo, 500, 'Escudo');
  if (escudo !== undefined) {
    // Só https: o escudo é renderizado em <img> por todos os apps.
    if (escudo !== null && !/^https:\/\/[^\s]+$/i.test(escudo)) throw new Error('Escudo deve ser uma URL https');
    dados.escudo = escudo;
  }

  return dados;
}

export function tipoCategoriaPorIdade(idade: number): 'INICIACAO' | 'BASE' {
  return idade <= 10 ? 'INICIACAO' : 'BASE';
}

export function validarBusca(valor: unknown): string {
  return String(valor ?? '').trim().slice(0, 80);
}

export function validarLimite(valor: unknown, padrao: number, max: number): number {
  const n = Number(valor);
  if (!Number.isSafeInteger(n) || n < 1) return padrao;
  return Math.min(n, max);
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export type NivelLog = 'info' | 'warn' | 'error' | 'audit';

export interface EntradaLog {
  id: number;
  ts: string;
  nivel: NivelLog;
  tipo: 'http' | 'audit' | 'sistema';
  mensagem: string;
  metodo?: string;
  caminho?: string;
  status?: number;
  ms?: number;
  usuarioId?: number | null;
}

export function nivelPorStatus(status: number): NivelLog {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

// Remove a query string (pode conter e-mails/buscas) e mascara segmentos que
// parecem credenciais (códigos de convite, tokens). Nunca registramos corpo
// nem cabeçalhos: só método, caminho, status e duração.
export function limparCaminho(url: string): string {
  const semQuery = String(url || '').split('?')[0].split('#')[0];
  return semQuery
    .split('/')
    .map(segmento => (/^[A-Za-z0-9_-]{16,}$/.test(segmento) ? ':token' : segmento))
    .join('/')
    .slice(0, 200);
}

export class BufferLogs {
  private itens: EntradaLog[] = [];
  private proximoId = 1;
  private readonly emissor = new EventEmitter();

  constructor(private readonly capacidade = 500) {
    this.emissor.setMaxListeners(20);
  }

  registrar(entrada: Omit<EntradaLog, 'id' | 'ts'>): EntradaLog {
    const completa: EntradaLog = { ...entrada, id: this.proximoId++, ts: new Date().toISOString() };
    this.itens.push(completa);
    if (this.itens.length > this.capacidade) this.itens.splice(0, this.itens.length - this.capacidade);
    this.emissor.emit('log', completa);
    return completa;
  }

  snapshot(limite = 200, nivelMinimo?: NivelLog): EntradaLog[] {
    const ordem: Record<NivelLog, number> = { info: 0, audit: 0, warn: 1, error: 2 };
    const filtrados = nivelMinimo
      ? this.itens.filter(item => ordem[item.nivel] >= ordem[nivelMinimo])
      : this.itens;
    return filtrados.slice(-limite);
  }

  assinar(ouvinte: (entrada: EntradaLog) => void): () => void {
    this.emissor.on('log', ouvinte);
    return () => this.emissor.off('log', ouvinte);
  }

  get tamanho() {
    return this.itens.length;
  }
}
