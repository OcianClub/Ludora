const assert = require('node:assert/strict');
const { test } = require('node:test');
const { enderecoLocal } = require('../../../scripts/configure-local-apk.cjs');

test('APK local exige IPv4 do notebook, usa Wi-Fi e rejeita IP antigo', () => {
  const interfaces = { 'Wi-Fi': [{ address: '192.168.15.12', family: 'IPv4', internal: false }], 'vEthernet': [{ address: '172.16.0.1', family: 'IPv4', internal: false }] };
  assert.equal(enderecoLocal(interfaces), 'http://192.168.15.12:3000');
  assert.equal(enderecoLocal(interfaces, '192.168.15.12'), 'http://192.168.15.12:3000');
  assert.throws(() => enderecoLocal(interfaces, '10.32.240.152'));
  assert.throws(() => enderecoLocal(interfaces, '127.0.0.1'));
});
