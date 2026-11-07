import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descobrirFonte, guardarDescoberta } from '../src/modules/paulista/discovery';
const equipes = '<a href="/evento/900/equipe/12423"><p>Harbor FC</p></a>';
test('Descoberta: só temporadas publicadas e título Paulista, sem inventar 2027', async () => {
  const paths: string[] = [];
  const rows = await descobrirFonte(async p => {
    paths.push(p);
    if (p === '/') return '<select id="select_temporada"><option value="2026">2026</option></select>';
    if (p.includes('get_divisoes')) return { divisoes: [{ id_divisao: 4, nome: 'A2' }] };
    if (p.includes('get_categorias')) return [{ id_evento: 900, id_titulo: 16, temporada: 2026, categoria: { nome: 'Sub-7' } }, { id_evento: 999, id_titulo: 17, temporada: 2026, categoria: { nome: 'Sub-8' } }];
    return equipes;
  }, 2026);
  assert.equal(rows.length, 1); assert.equal(rows[0].id, 900); assert.ok(paths.every(p => !p.includes('2027')));
});
test('Descoberta: temporada seguinte só entra com catálogo real e falha de formato é explícita', async () => {
  const rows = await descobrirFonte(async p => {
    if (p === '/') return '<select id="select_temporada"><option value="2027">2027</option></select>';
    if (p.includes('get_divisoes')) return { divisoes: [] };
    throw new Error('Não deveria consultar eventos inexistentes');
  }, 2026);
  assert.equal(rows.length, 0);
  await assert.rejects(() => descobrirFonte(async () => '<html>Changed</html>', 2026), /Seletor/);
});
