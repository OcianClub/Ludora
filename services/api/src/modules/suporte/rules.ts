import { createHash } from 'node:crypto';

export const STATUS_CHAMADO = ['NOVO', 'EM_TRIAGEM', 'AGUARDANDO_CLIENTE', 'EM_ANDAMENTO', 'ENCAMINHADO_DEVS', 'RESOLVIDO', 'REABERTO'] as const;
export const TIPOS_CHAMADO = ['CONVITE', 'RECUPERACAO', 'SEGURANCA', 'CONFIGURACAO', 'DUVIDA', 'ERRO', 'OUTRO'] as const;

export function sanitizar(valor: unknown, limite = 4000): string {
  return String(valor ?? '').slice(0, limite)
    .replace(/(?:Bearer\s+)?eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token removido]')
    .replace(/(?:senha|password|token|secret|codigo|código|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '[segredo removido]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[documento removido]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email removido]')
    .replace(/\b[A-Z\d]{4}-[A-Z\d]{4}\b/g, '[código removido]')
    .replace(/\b\d{6}\b/g, '[código removido]')
    .replace(/\b[a-zA-Z\d_-]{32,}\b/g, '[identificador removido]');
}

export function rotaSegura(valor: unknown): string {
  let caminho = String(valor || '/').split(/[?#]/)[0];
  if (/^https?:\/\//.test(caminho)) {
    try { caminho = new URL(caminho).pathname; } catch { return '/'; }
  }
  return sanitizar(caminho.replace(/\/((?:codigo|token|convites?|recuperar|redefinir)[^/]*)\/[^/]+/gi, '/$1/[removido]'), 250);
}

export function classificar(tipo: string, repeticoes: number, clubes: number, status = 0) {
  if (['RECUPERACAO', 'SEGURANCA'].includes(tipo)) return { fila: 'RESTRITA', prioridade: 'ALTA', regra: 'SEGURANCA_OU_RECUPERACAO', restrito: true };
  if (clubes >= 3 || repeticoes >= 10) return { fila: 'DESENVOLVIMENTO', prioridade: 'ALTA', regra: 'FALHA_ABRANGENTE', restrito: false };
  if (status >= 500 && repeticoes >= 3) return { fila: 'DESENVOLVIMENTO', prioridade: 'ALTA', regra: 'HTTP_500_RECORRENTE', restrito: false };
  if (['CONVITE', 'CONFIGURACAO', 'DUVIDA'].includes(tipo)) return { fila: 'SUPORTE', prioridade: 'NORMAL', regra: 'OPERACAO_CONHECIDA', restrito: false };
  return { fila: 'SUPORTE', prioridade: 'NORMAL', regra: 'TRIAGEM_HUMANA', restrito: false };
}

export function fingerprint(servico: string, rota: string, categoria: string) {
  return createHash('sha256').update([servico, rota.replace(/\/\d+(?=\/|$)/g, '/:id'), categoria].join('|')).digest('hex');
}
