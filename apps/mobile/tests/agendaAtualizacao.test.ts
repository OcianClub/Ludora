import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reutilizarPartidasAgenda } from '../src/utils/agendaJogos';

test('atualização idêntica da agenda preserva a lista e as referências dos cards', () => {
  const antes = [{ id: 1, status: 'AGENDADA', mandante: { nome: 'Ocian' } }, { id: 2, status: 'AO_VIVO', mandante: { nome: 'Santos' } }];
  assert.equal(reutilizarPartidasAgenda(antes, structuredClone(antes)), antes);
  const alteradas = structuredClone(antes);
  alteradas[1].status = 'FINALIZADA';
  const depois = reutilizarPartidasAgenda(antes, alteradas);
  assert.equal(depois[0], antes[0]);
  assert.equal(depois[1], alteradas[1]);
  assert.equal(depois[1].status, 'FINALIZADA');
});

test('agenda respeita a ordem e remove partidas que saem dos filtros', () => {
  const antes = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(reutilizarPartidasAgenda(antes, [{ id: 2 }, { id: 1 }]), [antes[1], antes[0]]);
  assert.deepEqual(reutilizarPartidasAgenda(antes, [{ id: 2 }]), [antes[1]]);
  assert.deepEqual(reutilizarPartidasAgenda(antes, []), []);
});
