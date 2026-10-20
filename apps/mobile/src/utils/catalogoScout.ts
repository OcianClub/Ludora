import type { Jogador } from '../services/mlService';
import { calcularResumo, type ResumoCategoria } from './resumoScout';
import type { PerfilScout } from './filtrosScout';

type DadosCategoria = {
  jogadores: Jogador[];
  resumo: ResumoCategoria;
  contagens: Record<PerfilScout, number>;
};

export const normalizarCategoriaScout = (
  categoria: string | undefined | null
) => (categoria ?? '').trim().toLowerCase().replace(/\s+/g, '-');

export const chaveCategoriaScout = (tipo: string, categoria: string) =>
  `${tipo}:${normalizarCategoriaScout(categoria)}`;

function categoriaVazia(): DadosCategoria {
  return {
    jogadores: [],
    resumo: calcularResumo([]),
    contagens: {
      Todos: 0,
      Artilheiro: 0,
      Armador: 0,
      Paredão: 0,
      'Sem dados': 0,
    },
  };
}

export const CATEGORIA_SCOUT_VAZIA = categoriaVazia();

export function criarCatalogoScout(jogadores: Jogador[]) {
  const catalogo = new Map<string, DadosCategoria>();
  for (const jogador of jogadores) {
    const chave = chaveCategoriaScout(
      jogador.categoria_tipo ?? '',
      jogador.categoria
    );
    const categoria = catalogo.get(chave) ?? categoriaVazia();
    categoria.jogadores.push(jogador);
    categoria.contagens.Todos++;
    if (
      Object.prototype.hasOwnProperty.call(
        categoria.contagens,
        jogador.perfil_ml
      ) &&
      jogador.perfil_ml !== 'Todos'
    ) {
      categoria.contagens[jogador.perfil_ml as PerfilScout]++;
    }
    catalogo.set(chave, categoria);
  }
  for (const categoria of catalogo.values())
    categoria.resumo = calcularResumo(categoria.jogadores);
  return catalogo;
}
