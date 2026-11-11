import type { GestaoPartida } from '../services/partidasCompartilhadas';
import { matchInsights } from '../../../../packages/shared-types/src/matchInsights';
import { mensagemResultado } from './sumulaPartida';
export function resultadoCompartilhavel(data: GestaoPartida, nomes: boolean, destaques: boolean, link: string) {
  const times = matchInsights(data, null);
  const grupos = (['attack', 'saves'] as const).map(key => {
    const all = times.flatMap(t => t[key].map(p => ({ ...p, team: t.name })));
    const max = Math.max(0, ...all.map(p => p[key]));
    return { key, titulo: key === 'attack' ? 'Participação em gols' : 'Defesas registradas', jogadores: all.filter(p => p[key] === max) };
  });
  const texto = [mensagemResultado(data, nomes, link)];
  if (destaques) for (const grupo of grupos) {
    texto.push(`\n${grupo.titulo} · Ludora`);
    texto.push(...grupo.jogadores.map(p => `${nomes ? p.name : `Camisa ${String(p.shirt).padStart(2, '0')}`} · ${p.team}: ${grupo.key === 'attack' ? `${p.goals} gols · ${p.assists} assist.` : `${p.saves} defesas`}`));
    if (!grupo.jogadores.length) texto.push('Sem registros com autoria.');
  }
  return { times, grupos, texto: texto.join('\n') };
}
/** Limites de linhas explícitos, sem recortar silenciosamente nomes longos na imagem. */
export function linhasTexto(text: string, limite = 32) {
  const linhas: string[] = [];
  for (const palavra of text.trim().split(/\s+/).flatMap(word => {
    const chars = Array.from(word), partes: string[] = [];
    while (chars.length) partes.push(chars.splice(0, limite).join(''));
    return partes;
  })) {
    if (!linhas.length || `${linhas.at(-1)} ${palavra}`.length > limite) linhas.push(palavra);
    else linhas[linhas.length - 1] += ` ${palavra}`;
  }
  return linhas;
}
