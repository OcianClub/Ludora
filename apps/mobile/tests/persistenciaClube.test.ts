import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarPersistenciaClube, type ClubePersistido } from '../src/utils/persistenciaClube';

function adiar() {
  let resolver!: () => void;
  const promessa = new Promise<void>((resolve) => { resolver = resolve; });
  return { promessa, resolver };
}

const clube = (id: number): ClubePersistido => ({
  id, nome: `Clube ${id}`, escudo: null, papel: 'TECNICO',
});

function preparar() {
  const dados = new Map<string, string>();
  const aplicados: (ClubePersistido | null)[] = [];
  const storage = {
    async getItemAsync(chave: string) { return dados.get(chave) ?? null; },
    async setItemAsync(chave: string, valor: string) { dados.set(chave, valor); },
    async deleteItemAsync(chave: string) { dados.delete(chave); },
  };
  return { dados, aplicados, storage };
}

test('trocas concorrentes persistem um clube completo e aplicam somente a última escolha', async () => {
  const { dados, aplicados, storage } = preparar();
  const pausa = adiar();
  const original = storage.setItemAsync;
  storage.setItemAsync = async (chave, valor) => {
    if (valor === 'Clube 1') await pausa.promessa;
    await original(chave, valor);
  };
  const persistencia = criarPersistenciaClube(storage, (valor) => aplicados.push(valor));
  const primeira = persistencia.definir(clube(1));
  const segunda = persistencia.definir(clube(2));
  pausa.resolver();
  await Promise.all([primeira, segunda]);
  assert.equal(dados.get('clubeAtivoId'), '2');
  assert.equal(dados.get('clubeAtivoNome'), 'Clube 2');
  assert.deepEqual(aplicados, [clube(2)]);
});

test('logout durante persistência não restaura clube nem deixa chaves antigas', async () => {
  const { dados, aplicados, storage } = preparar();
  const pausa = adiar();
  storage.setItemAsync = async (chave, valor) => {
    await pausa.promessa;
    dados.set(chave, valor);
  };
  const persistencia = criarPersistenciaClube(storage, (valor) => aplicados.push(valor));
  const troca = persistencia.definir(clube(1));
  const limpeza = persistencia.limpar();
  assert.deepEqual(aplicados, [null]);
  pausa.resolver();
  await Promise.all([troca, limpeza]);
  assert.equal(dados.size, 0);
  assert.deepEqual(aplicados, [null]);
});

test('restauração antiga não sobrepõe escolha feita durante leitura', async () => {
  const { dados, aplicados, storage } = preparar();
  const pausa = adiar();
  dados.set('clubeAtivoId', '1');
  dados.set('clubeAtivoNome', 'Clube 1');
  storage.getItemAsync = async (chave) => {
    const antigo = dados.get(chave) ?? null;
    await pausa.promessa;
    return antigo;
  };
  const persistencia = criarPersistenciaClube(storage, (valor) => aplicados.push(valor));
  const restauracao = persistencia.restaurar();
  await Promise.resolve();
  await persistencia.definir(clube(2));
  pausa.resolver();
  await restauracao;
  assert.deepEqual(aplicados, [clube(2)]);
});

test('falha em uma escrita aguarda demais operações e não impede limpeza posterior', async () => {
  const { dados, aplicados, storage } = preparar();
  const pausa = adiar();
  storage.setItemAsync = async (chave, valor) => {
    if (chave === 'clubeAtivoNome') throw new Error('Falha do armazenamento');
    await pausa.promessa;
    dados.set(chave, valor);
  };
  const persistencia = criarPersistenciaClube(storage, (valor) => aplicados.push(valor));
  const troca = assert.rejects(persistencia.definir(clube(1)), /Falha do armazenamento/);
  const limpeza = persistencia.limpar();
  pausa.resolver();
  await Promise.all([troca, limpeza]);
  assert.equal(dados.size, 0);
  assert.deepEqual(aplicados, [null]);
});

test('restauração invalida após desmontagem e rejeita papéis desconhecidos', async () => {
  const { dados, aplicados, storage } = preparar();
  dados.set('clubeAtivoId', '3');
  dados.set('clubeAtivoPapel', 'SUPER_ADMIN');
  const persistencia = criarPersistenciaClube(storage, (valor) => aplicados.push(valor));
  const inicial = persistencia.restaurar();
  persistencia.invalidar();
  await inicial;
  assert.equal(aplicados.length, 0);
  await persistencia.restaurar();
  assert.equal(aplicados[0]?.papel, null);
});
