import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamName, teamKey } from '../src/utils/teamIdentity.ts';
test('subs legados formam um só clube sem modificar nomes internos',()=>{
  assert.equal(teamKey(' Estrela Azul sub-7 '),teamKey('ESTRELA  AZUL Sub 14'));
  assert.equal(teamName('Santos (sub-18)'), 'Santos');
  assert.equal(teamName('Submarino FC'), 'Submarino FC');
  assert.notEqual(teamKey('Santos'),teamKey('Santos Praia'));
});
