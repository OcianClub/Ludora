const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { escolherHostLan } = require('./start-mobile.cjs');

function enderecoLocal(interfaces, informado) {
  const ip = informado || escolherHostLan(interfaces);
  const conectado = Object.values(interfaces).some(items => items?.some(item => !item.internal && item.address === ip));
  if (net.isIP(ip || '') !== 4 || !conectado) {
    throw new Error('Informe o IPv4 do notebook conectado ao hotspot: node scripts/configure-local-apk.cjs 192.168.x.x');
  }
  return `http://${ip}:3000`;
}

function main() {
  const url = enderecoLocal(os.networkInterfaces(), process.argv[2]);
  const arquivo = path.resolve(__dirname, '../apps/mobile/eas.json');
  const config = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  config.build['preview-local'].env.EXPO_PUBLIC_API_URL = url;
  fs.writeFileSync(arquivo, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`APK Local configurado para ${url}`);
  console.log(`Confira ${url}/health no navegador do celular com a API ligada antes de gerar o APK.`);
  console.log('Se o IPv4 mudar, configure novamente e gere outro APK Local.');
}

module.exports = { enderecoLocal };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
