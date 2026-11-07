// Verificação somente leitura com conta administrativa já existente.
// Não imprime nem persiste token, senha, CPF ou endereço de conexão.
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma';
import { criarApp } from '../src/app';
import { criarSocketServer } from '../src/realtime/socket';
import { JWT_OPTIONS, JWT_SECRET } from '../src/config/env';
async function main() {
  const clubeId = Number(process.env.CLUBE_VERIFICACAO_ID || 2);
  const user = await prisma.usuario.findFirstOrThrow({ where: { papel_plataforma: 'SUPERADMIN' }, select: { id: true, versao_sessao: true } });
  const token = jwt.sign({ id: user.id, versao_sessao: user.versao_sessao }, JWT_SECRET, JWT_OPTIONS);
  const io = criarSocketServer(), app = criarApp(io), server = app.listen(0, '127.0.0.1'); io.attach(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const port = (server.address() as import('node:net').AddressInfo).port;
    for (const path of ['/competicoes', '/paulista/eventos', '/admin/paulista']) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { Authorization: `Bearer ${token}`, 'x-clube-id': String(clubeId) } });
      if (!r.ok) throw new Error(`Verificação ${path}: HTTP ${r.status}`);
      const body = await r.json() as any;
      console.log('PASS', path, Array.isArray(body) ? `${body.length} registros` : `${body.catalogo?.length ?? 0} eventos no catálogo`);
    }
    console.log('Leitura autenticada verificada; nenhuma gravação realizada.');
    if (process.argv.includes('--browser')) {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ channel: 'msedge', headless: true });
      const clube = await prisma.clube.findUniqueOrThrow({ where: { id: clubeId }, select: { id: true, nome: true, escudo: true } });
      try {
        const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
        await context.addInitScript(({ token, clube, userId }: any) => {
          localStorage.setItem('ludora_token', token);
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: userId, nome: 'Administração' }));
          localStorage.setItem('ludora_clube', JSON.stringify(clube));
          localStorage.setItem('ludora_clube_id', String(clube.id));
          localStorage.setItem('ludora_tema', 'dark');
        }, { token, clube, userId: user.id });
        const page = await context.newPage();
        await page.goto('http://localhost:5173/competicoes');
        await page.getByRole('heading', { name: 'Competições', exact: true }).waitFor();
        await page.getByRole('link', { name: /^Abrir Paulista/ }).click();
        await page.locator('.paulista-overview').waitFor();
        await page.getByRole('button', { name: 'Jogos', exact: true }).click();
        await page.getByText('25 jogos encontrados · por data', { exact: true }).waitFor();
        if (await page.getByRole('button', { name: 'Sincronizar fonte', exact: true }).count()) throw new Error('Controle administrativo indevido no web.');
        await page.screenshot({ path: '../../test-results/paulista/web-supabase-real.png', fullPage: false });
        console.log('PASS browser real: Competições → Paulista, 25 jogos do clube, sem operação técnica.');
      } finally { await browser.close(); }
    }
  } finally { await new Promise<void>(r => io.close(() => r())); await prisma.$disconnect(); }
}
main().catch(() => { console.error('Falha na verificação. Confira migrations, flags e conta administrativa existente.'); process.exitCode = 1; });
