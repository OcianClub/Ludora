const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';
const output = path.resolve(__dirname, '../../../test-results/match-post-game');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 1440]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
      await context.addInitScript(({theme, guest}) => {
        localStorage.setItem('ludora_tema', theme);
        if (!guest) {
          localStorage.setItem('ludora_token', 'test'); localStorage.setItem('ludora_usuario', JSON.stringify({id:1,nome:'Alex'}));
          localStorage.setItem('ludora_clube', JSON.stringify({id:2,nome:'Ocian',meuPapel:'ADMIN'})); localStorage.setItem('ludora_clube_id','2');
        }
        window.drawnText = [];
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function(...args) { window.drawnText.push(args[0]); return original.apply(this,args); };
      }, { theme, guest: width === 820 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      let visual;
      await require('./visual-fixture.cjs').install(page, { decorate: data => { visual = data; } });
      await page.route('**/publico/clubes/2/*', route => route.fulfill({ json: visual[new URL(route.request().url()).pathname.split('/').pop()] || [] }));
      const players = [101,102,103,104,105,106].map((id,i) => ({ jogador_id:id,numCamisa:i+1,titular:i<5,time_id:13,ordem:i,jogador:{nome:`Atleta Ocian ${i+1}`,posicao:'Fixo'} }));
      const opponent = players.map((p,i) => ({...p,jogador_id:p.jogador_id+100,time_id:14,jogador:{nome:`Atleta Santos ${i+1}`,posicao:'Alas'}}));
      const match = { id:106,status:'FINALIZADA',data:'2026-11-07',horario:'19:30',local:'Ginásio Ocian',categoria_id:1,categoria:{id:1,nome:'sub-7'},mandante_id:13,visitante_id:14,mandante:{id:13,nome:'Ocian',escudo:'https://assets.invalid/ocian.png'},visitante:{id:14,nome:'Santos'},gols_mandante:3,gols_visitante:1,periodo_atual:3,versao:1,sumula_clube_id:2,titulares_necessarios:5 };
      const events = [
        {id:1,tipo:'GOL',time_id:13,jogador_id:101,jogador:players[0].jogador,periodo:1},
        {id:2,tipo:'GOL',time_id:13,jogador_id:102,jogador:players[1].jogador,periodo:2},
        {id:3,tipo:'GOL',time_id:13,jogador_id:201,jogador:opponent[0].jogador,gol_contra:true,periodo:1},
        {id:4,tipo:'GOL',time_id:14,jogador_id:202,jogador:opponent[1].jogador,periodo:2},
        {id:5,tipo:'DEFESA',time_id:13,jogador_id:103,jogador:players[2].jogador,periodo:1},
      ];
      let writes = 0;
      await page.route(url => url.origin !== new URL(base).origin && /\/(?:publico\/)?partidas\/106(?:\/gestao)?$/.test(url.pathname), route => route.fulfill({json:{clube:{id:2,nome:'Ocian'},partida:match,organizador:{id:2,nome:'Ocian'},minhaEquipeId:width===820?undefined:1,podePreparar:width!==820,podeSumula:width!==820,eventos:events,auditoria:[],equipes:[
        {id:1,clube_id:2,time_id:13,categoria_id:1,clube:{id:2,nome:'Ocian'},publicada_em:'2026-11-07',pronta:true,escalacao:players},
        {id:2,clube_id:3,time_id:14,categoria_id:2,clube:{id:3,nome:'Santos'},publicada_em:'2026-11-07',pronta:true,escalacao:opponent},
      ]}}));
      await page.route('**/partidas/106/palpite', route => { if(route.request().method()!=='GET') writes++; return route.fulfill({json:{partida_id:106,revisao:1,status:'FINALIZADA',aberta:false,total:5,votos:{MANDANTE:3,EMPATE:1,VISITANTE:1},percentuais:{MANDANTE:60,EMPATE:20,VISITANTE:20},meuVoto:null}}); });
      page.on('request', request => { if (['POST','PATCH','PUT','DELETE'].includes(request.method())) writes++; });
      await page.goto(base+'/partidas/106');
      await page.getByRole('heading',{name:'Resultado da partida',exact:true}).waitFor();
      assert.equal(await page.locator('.match-result-outcome').innerText(),'Vitória do Ocian!');
      assert.equal(await page.getByRole('button',{name:'Desfazer último',exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Editar partida',exact:true}).count(),0);
      await page.locator('.match-poll-options').waitFor();
      assert.equal(await page.locator('.match-poll-options button:not(:disabled)').count(),0);
      const filter=page.getByRole('group',{name:'Consultar registros por tempo'});
      await filter.getByRole('button',{name:'1º tempo',exact:true}).click();
      assert.deepEqual(await page.locator('.live-timeline-event').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.eventId))),[5,3,1]);
      assert.equal(await page.locator('.match-insights-metric').first().locator('dd strong').first().innerText(),'2');
      assert.equal(await page.locator('.live-player-statistics').first().getAttribute('aria-label'),'Estatísticas de Atleta Ocian 1');
      assert.match(await page.locator('.match-result-score').getAttribute('aria-label'),/Ocian 3 a 1 Santos/);
      await filter.getByRole('button',{name:'3º tempo',exact:true}).click();
      await page.getByText('Nenhum evento no 3º tempo',{exact:true}).waitFor();
      await filter.getByRole('button',{name:'Todos',exact:true}).click();
      assert.equal(await page.locator('.live-timeline-event').count(),5);
      assert.equal(writes,0,'Consultar períodos não altera partida nem votação');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sem overflow horizontal');
      await page.screenshot({path:path.join(output,`summary-${width}-${theme}.png`),fullPage:true});
      await page.getByRole('button',{name:'Compartilhar resultado',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'Compartilhar resultado',exact:true});
      await dialog.locator('.match-image-preview img').waitFor();
      assert.doesNotMatch((await page.evaluate(()=>window.drawnText.join('\n'))),/Atleta Ocian|Atleta Santos/);
      const downloadEvent=page.waitForEvent('download');
      await dialog.getByRole('button',{name:'Baixar imagem',exact:true}).click();
      const download=await downloadEvent; await download.saveAs(path.join(output,`result-${width}-${theme}.png`));
      const png=fs.readFileSync(await download.path());
      assert.equal(png.subarray(1,4).toString(),'PNG'); assert.equal(png.readUInt32BE(16),1080);
      assert.ok(png.readUInt32BE(20)>1250, 'Imagem inclui os destaques');
      await dialog.getByRole('switch',{name:'Incluir nomes dos jogadores',exact:true}).click();
      await dialog.locator('.match-image-preview img[alt*="com autores"]').waitFor();
      await dialog.locator('.match-image-preview img').evaluate(img => img.decode());
      const previewBounds = await dialog.locator('.match-image-preview').boundingBox();
      const imageBounds = await dialog.locator('.match-image-preview img').boundingBox();
      assert.ok(previewBounds.height >= imageBounds.height, 'A prévia não corta os autores no fim da imagem');
      assert.match(await page.evaluate(()=>window.drawnText.join('\n')),/Atleta Ocian 1|Atleta Santos 1 \(contra\)/);
      await page.screenshot({path:path.join(output,`share-${width}-${theme}.png`)});
      if(width===1440&&theme==='dark') {
        const second=page.waitForEvent('download'); await dialog.getByRole('button',{name:'Baixar imagem',exact:true}).click();
        await (await second).saveAs(path.join(output,'result-with-names.png'));
        await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copied=value;}}}));
        await dialog.getByRole('button',{name:'Copiar link da partida',exact:true}).click();
        assert.match(await page.evaluate(()=>window.copied),/\/partidas\/106$/);
        await dialog.getByRole('switch',{name:'Incluir nomes dos jogadores',exact:true}).click(); await dialog.getByRole('switch',{name:'Incluir nomes dos jogadores',exact:true}).click(); await dialog.getByRole('switch',{name:'Incluir nomes dos jogadores',exact:true}).click();
        await dialog.locator('.match-image-preview img[alt*="sem nomes"]').waitFor();
        assert.equal(await dialog.getByRole('button',{name:'Baixar imagem',exact:true}).isEnabled(),true,'Prévia e arquivo correspondem à última escolha');
      }
      await dialog.getByRole('button',{name:'Voltar',exact:true}).click();
      assert.deepEqual(errors,[]); console.log(`OK pós-jogo/imagem ${width}px ${theme}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
