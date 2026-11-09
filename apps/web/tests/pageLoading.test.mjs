import test from 'node:test';
import assert from 'node:assert/strict';
import { loadingPage } from '../src/utils/pageLoading.ts';

test('cada rota de trabalho escolhe o skeleton da página, inclusive links públicos e históricos', () => {
  for (const [path, expected] of [
    ['/dashboard','home'], ['/clubes/2','home'], ['/clubes/2/partidas','schedule'],
    ['/partidas','schedule'], ['/partidas/solicitacoes','requests'], ['/partidas/10','match'],
    ['/jogadores','players'], ['/jogadores/7','player'], ['/jogadores/7/partidas','player'],
    ['/jogadores/7/campeonatos','player'], ['/elenco','scout'], ['/times','teams'],
    ['/clube','club'], ['/perfil','profile'], ['/membros','members'],
    ['/competicoes','competition'], ['/competicoes/paulista','competition'], ['/clubes/2/competicoes','competition'],
  ]) assert.equal(loadingPage(path), expected, path);
});
