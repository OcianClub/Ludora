import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPositionDefinition, positionDefinitions, positionStrokeWidth } from '../../../packages/design-tokens/src/positions.ts';
import { darkColors, lightColors } from '../../../packages/design-tokens/src/colors.ts';
test('as quatro posições têm geometria própria e tokens disponíveis nos dois temas',()=>{
  const icons=Object.values(positionDefinitions);
  assert.equal(icons.length,4);
  assert.equal(new Set(icons.map(icon=>JSON.stringify(icon.paths))).size,4);
  assert.equal(new Set(icons.map(icon=>icon.color)).size,4);
  for(const icon of icons)for(const theme of [darkColors,lightColors])assert.ok(theme[icon.color]);
  assert.equal(positionStrokeWidth,1.6);
});
test('Ala e Alas resolvem o mesmo desenho; entradas antigas e posições ausentes são tratadas',()=>{
  assert.equal(getPositionDefinition('Ala'),getPositionDefinition('Alas'));
  assert.equal(getPositionDefinition('Ala Esquerdo'),getPositionDefinition('Alas'));
  assert.equal(getPositionDefinition('Pivo'),getPositionDefinition('Pivô'));
  assert.equal(getPositionDefinition(null),undefined);
});
