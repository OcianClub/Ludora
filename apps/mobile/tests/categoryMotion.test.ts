import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorySnap, pageDestination } from '../src/utils/categoryMotion';
test('snap de categorias considera distância, velocidade, cancelamento e limites',()=>{
  assert.equal(categorySnap(1, 8, .01, 108, 4),1);
  assert.equal(categorySnap(1, -70, 0, 108, 4),2);
  assert.equal(categorySnap(1, 70, 0, 108, 4),0);
  assert.equal(categorySnap(1, -8, -.8, 108, 4),2);
  assert.equal(categorySnap(0, 100, 1, 108, 4),0);
  assert.equal(categorySnap(3, -100, -1, 108, 4),3);
});
test('pager conclui por distância ou velocidade e retorna gestos curtos aos limites',()=>{
  assert.equal(pageDestination(0,.12,.05,4),0);
  assert.equal(pageDestination(0,.35,0,4),1);
  assert.equal(pageDestination(0,.07,2,4),1);
  assert.equal(pageDestination(1,.93,-2,4),0);
  assert.equal(pageDestination(1,1.3,-2,4),1);
  assert.equal(pageDestination(0,0,-4,4),0);
  assert.equal(pageDestination(3,3,4,4),3);
});
