const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { escolherPorta, portaDisponivel, escolherHostLan, obterLinksExpo, aguardarLinksExpo, mostrarAcesso } = require('../../../scripts/start-mobile.cjs');

test('inicialização do mobile evita porta ocupada sem encerrar o processo existente', async t => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  assert.equal(await portaDisponivel(port), false);
  await assert.rejects(escolherPorta(port, port), /ocupadas/);
  if (port < 65535) {
    const next = await escolherPorta(port, Math.min(port + 10, 65535));
    assert.ok(next > port);
  }
  assert.equal(server.listening, true, 'O servidor que já estava aberto é preservado');
});


const interfaceIpv4 = (address, internal = false) => [{ family: 'IPv4', address, internal }];
const interfaces = {
  loopback: interfaceIpv4('127.0.0.1', true),
  'vEthernet (Default Switch)': interfaceIpv4('172.23.160.1'),
  'Radmin VPN': interfaceIpv4('26.94.92.50'),
  Ethernet: interfaceIpv4('192.168.15.2'),
};

test('link LAN prefere a rede física em vez de VPN e Hyper-V', () => {
  assert.equal(escolherHostLan(interfaces), '192.168.15.2');
  assert.equal(escolherHostLan(interfaces, { EXPO_PUBLIC_API_URL: 'https://api.onrender.com' }), '192.168.15.2');
  assert.equal(escolherHostLan(interfaces, { EXPO_PUBLIC_API_URL: 'http://192.168.15.99:3000' }), '192.168.15.2');
  assert.equal(escolherHostLan({ loopback: interfaces.loopback }), undefined);
});

test('preserva host explícito e prefere a interface correspondente à API local', () => {
  const redes = { ...interfaces, 'Wi-Fi': interfaceIpv4('10.0.0.9') };
  assert.equal(escolherHostLan(redes, { EXPO_PUBLIC_API_URL: 'http://10.0.0.9:3000' }), '10.0.0.9');
  assert.equal(escolherHostLan(redes, { REACT_NATIVE_PACKAGER_HOSTNAME: ' 192.168.1.12 ' }), '192.168.1.12');
});

test('obtém o scheme e a porta reais do Expo sem seguir o deep link', async () => {
  const link = 'ludora://expo-development-client/?url=http%3A%2F%2F192.168.15.2%3A8083';
  const chamadas = [];
  const links = await obterLinksExpo(8083, { consultar: async (url, options) => {
    chamadas.push(url);
    assert.equal(options.redirect, 'manual');
    return url.endsWith('/status') ? new Response('packager-status:running') : new Response(null, { status: 307, headers: { location: link } });
  } });
  assert.deepEqual(links, { link, servidor: 'http://192.168.15.2:8083' });
  assert.equal(chamadas[1], 'http://127.0.0.1:8083/_expo/link?platform=android&choice=expo-dev-client');
});

test('não anuncia serviço que não seja Metro e encerra espera ao cancelar', async () => {
  assert.equal(await obterLinksExpo(8081, { consultar: async () => new Response('outro serviço') }), null);
  const controller = new AbortController();
  controller.abort();
  assert.equal(await aguardarLinksExpo(8081, { signal: controller.signal }), null);
});

test('preserva link de túnel e diferencia Expo Go do APK de desenvolvimento', async () => {
  const consultar = link => async url => url.endsWith('/status') ? new Response('packager-status:running') : new Response(null, { status: 307, headers: { location: link } });
  const tunnel = 'exp+ludora://expo-development-client/?url=https%3A%2F%2Fexample.exp.direct';
  assert.deepEqual(await obterLinksExpo(8081, { consultar: consultar(tunnel) }), { link: tunnel, servidor: 'https://example.exp.direct' });
  const go = 'exp://192.168.15.2:8081';
  assert.deepEqual(await obterLinksExpo(8081, { go: true, consultar: consultar(go) }), { link: go, servidor: 'http://192.168.15.2:8081' });
  assert.equal(await obterLinksExpo(8081, { consultar: consultar('http://localhost:8081') }), null);
});

test('imprime QR code e os dois endereços mesmo sem terminal interativo', () => {
  const path = require('node:path');
  const saida = [];
  const links = { link: 'ludora://expo-development-client/?url=http%3A%2F%2F192.168.15.2%3A8081', servidor: 'http://192.168.15.2:8081' };
  mostrarAcesso(links, { cwd: path.resolve(__dirname, '../../../apps/mobile'), go: false, escrever: text => saida.push(text) });
  assert.ok(saida.some(text => text.includes(links.link)));
  assert.ok(saida.some(text => text.includes(links.servidor)));
  assert.ok(saida.some(text => text.includes('▄') || text.includes('▀') || text.includes('█')), 'O QR é desenhado no terminal');
  assert.ok(!saida.some(text => text.includes('indisponível')));
});
