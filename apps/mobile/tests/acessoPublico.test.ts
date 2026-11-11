import assert from 'node:assert/strict';
import { test } from 'node:test';
import { endpointVisitante } from '../src/utils/acessoPublico';

test('visitante usa consultas explicitamente públicas preservando clube e filtros', () => {
  assert.equal(endpointVisitante('/partidas/agenda?ano=2026&por_situacao=true', '2'), '/publico/clubes/2/partidas/agenda?ano=2026&por_situacao=true');
  assert.equal(endpointVisitante('/partidas/home?hoje=2026-11-10', '3'), '/publico/clubes/3/partidas/home?hoje=2026-11-10');
  assert.equal(endpointVisitante('/partidas/50/gestao', '3'), '/publico/partidas/50?clube_id=3');
  assert.equal(endpointVisitante('/partidas/50', null), '/publico/partidas/50');
  assert.equal(endpointVisitante('/categorias', '2'), '/publico/clubes/2/categorias');
});
test('visitante não transforma escritas ou dados privados em endpoints públicos', () => {
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) assert.equal(endpointVisitante('/partidas/50', '2', method), '/partidas/50');
  for (const path of ['/usuarios/me', '/jogadores', '/partidas/50/eventos', '/partidas/solicitacoes', '/notificacoes', '/clubes/2/seguir']) assert.equal(endpointVisitante(path, '2'), path);
  assert.equal(endpointVisitante('/categorias', null), '/categorias');
});
