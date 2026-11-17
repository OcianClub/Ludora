const assert = require('node:assert/strict');
const { chromium, expect } = require('playwright/test');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'test'); localStorage.setItem('ludora_tema', theme);
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
      }, theme);
      const page = await context.newPage(), errors = [], mutations = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      let operator = false;
      const p = { id: 106, status: 'AO_VIVO', data: '2026-11-17', horario: '19:30', local: 'Ginásio', categoria_id: 1, categoria: { id: 1, nome: 'sub-7' }, mandante_id: 13, visitante_id: 14, mandante: { id: 13, nome: 'Ocian' }, visitante: { id: 14, nome: 'Santos' }, gols_mandante: 1, gols_visitante: 0, periodo_atual: 2, versao: 1, sumula_clube_id: 2, titulares_necessarios: 5 };
      const events = [1, 2].map(periodo => ({id:periodo,tipo:'FALTA',periodo,time_id:13,jogador_id:null,criado_em:'2026-11-17T20:00:00Z'}));
      const data = () => ({ partida:p, organizador:{id:2,nome:'Ocian'}, podePreparar:operator, podeSumula:operator, minhaEquipeId:1, auditoria:[], eventos:events, substituicoes:[], equipes:[{id:1,clube_id:2,time_id:13,clube:{id:2,nome:'Ocian'},escalacao:[],publicada_em:'2026-11-17'}] });
      await page.route('**/partidas/106/gestao', route => route.fulfill({json:data()}));
      await page.route('**/partidas/106/periodo', route => {
        const body = route.request().postDataJSON(); mutations.push(body); p.periodo_atual = body.periodo; p.versao++;
        return route.fulfill({json:{}});
      });
      await page.clock.install();
      await page.goto(base + '/partidas/106');
      const stepper = page.getByRole('group', {name:'Tempo da partida',exact:true});
      const previous = stepper.getByRole('button',{name:'Voltar tempo'}), next = stepper.getByRole('button',{name:'Avançar tempo'});
      await expect(stepper.locator('strong')).toHaveText('2º tempo');
      await expect(next).toBeDisabled();
      await previous.click();
      await expect(stepper.locator('strong')).toHaveText('1º tempo');
      await expect(previous).toBeDisabled();
      await expect(page.locator('.live-timeline-period')).toHaveCount(1);
      assert.equal(p.periodo_atual,2); assert.equal(mutations.length,0);
      await next.click();
      await expect(stepper.locator('strong')).toHaveText('2º tempo');
      await expect(next).toBeDisabled();
      await expect(page.locator('.live-timeline-period')).toHaveCount(2);
      // An official update advances the live view without reloading.
      p.periodo_atual = 3; p.versao++;
      await page.clock.fastForward(16000);
      await expect(stepper.locator('strong')).toHaveText('3º tempo');
      await previous.click();
      // Stay on the chosen past period when the operator advances again.
      p.periodo_atual = 4; p.versao++;
      await page.clock.fastForward(16000);
      await expect(stepper.locator('strong')).toHaveText('2º tempo');
      await expect(stepper.locator('small')).toContainText('Atual: 4º tempo');
      // Clamp safely if the operator corrects the official period backwards.
      p.periodo_atual = 1; p.versao++;
      await page.clock.fastForward(16000);
      await expect(stepper.locator('strong')).toHaveText('1º tempo');
      await expect(previous).toBeDisabled(); await expect(next).toBeDisabled();
      assert.equal(mutations.length,0,'Viewer navigation must never change the official period');
      // The operator keeps the existing write action.
      operator = true; await page.reload();
      await expect(stepper.locator('strong')).toHaveText('1º tempo');
      await next.click();
      await expect(stepper.locator('strong')).toHaveText('2º tempo');
      assert.equal(mutations.length,1); assert.equal(p.periodo_atual,2);
      assert.deepEqual(errors,[]);
      console.log(`Viewer periods OK ${width}px ${theme}: read-only navigation, boundaries, realtime and operator`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
