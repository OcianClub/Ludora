// RN Web renders the actual mobile components; transport and native OS modules are isolated.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const mobile = createRequire(path.join(root, 'apps/mobile/package.json'));
const web = createRequire(fs.realpathSync(path.join(root, 'apps/web/node_modules/vite/package.json')));
const esbuild = web('esbuild');
const output = path.join(root, 'test-results/mobile-sumula'); fs.mkdirSync(output, { recursive: true });
const shim = path.join(output, 'native-shim.tsx'), backend = path.join(output, 'backend.ts'), entry = path.join(output, 'entry.tsx');
fs.writeFileSync(shim, `
import React from 'react'; import { View } from 'react-native';
import { darkColors } from '../../packages/design-tokens/src';
const listeners = new Map();
export const useTheme = () => ({ colors: darkColors, tema: 'dark' });
export const useSessao = () => ({ autenticado: !location.search.includes('guest'), carregando: false });
export const getItemAsync = async key => key === 'userToken' ? location.search.includes('guest') ? null : 'test-token' : sessionStorage.getItem(key);
export const setItemAsync = async (key,value) => { sessionStorage.setItem(key,value); };
export const SafeAreaView = View, LinearGradient = View;
export const useSafeAreaInsets = () => ({ top:0,bottom:24,left:0,right:0 });
const navigation = { addListener: (name,fn) => { listeners.set(name,fn); return () => listeners.delete(name); } };
export const useNavigation = () => navigation;
window.pauseFixture = () => listeners.get('blur')?.();
export const useRouter = () => ({ push: () => {}, back: () => {} });
export const cacheDirectory = '/mock/'; export const EncodingType = { Base64: 'base64' };
export const downloadAsync = async () => { throw Error('isolated'); };
export const readAsStringAsync = async () => ''; export const deleteAsync = async () => {};
export const writeAsStringAsync = async () => {}; export const getInfoAsync = async () => ({exists:false});
export const isAvailableAsync = async () => false, shareAsync = async () => {}, setStringAsync = async () => {};
export const StorageAccessFramework = {};
`);
fs.writeFileSync(backend, `
import { sumulaFixture } from '../../apps/mobile/tests/sumula.fixture';
export let model = sumulaFixture();
if (/guest|common|staff-elsewhere/.test(location.search)) { model.podePreparar = false; model.podeSumula = false; model.auditoria = []; }
if (location.search.includes('staff-team')) model.podeSumula = false;
if (location.search.includes('final')) model.partida.status = 'FINALIZADA';
model.eventos = []; model.partida.gols_mandante = 0; model.partida.gols_visitante = 0;
export const BASE_URL = '/isolated';
window.fixture = { writes: [], model, pollReads: 0 };
export async function apiFetch(endpoint, opts = {}) {
  const body = opts.body ? JSON.parse(opts.body) : {}, method = opts.method || 'GET';
  if (endpoint.endsWith('palpite')) {
    if(method==='PUT')window.fixture.vote=body.escolha;
    else window.fixture.pollReads++;
    const votos={MANDANTE:0,EMPATE:0,VISITANTE:0};votos[window.fixture.vote || 'MANDANTE']=1;
    return new Response(JSON.stringify({partida_id:model.partida.id,revisao:window.fixture.vote?2:1,status:model.partida.status,aberta:model.partida.status==='AO_VIVO',total:1,votos,percentuais:Object.fromEntries(Object.entries(votos).map(([key,value])=>[key,value*100])),meuVoto:window.fixture.vote || null,podeVotar:!location.search.includes('staff-elsewhere')}));
  }
  window.fixture.writes.push({ endpoint, method, body });
  if (endpoint.endsWith('/eventos') && method === 'POST') {
    const id=model.eventos.length+1;
    const jogador=model.equipes.flatMap(t=>t.escalacao).find(j=>j.jogador_id===body.jogador_id)?.jogador;
    model.eventos.push({id,...body,jogador});
    if (body.tipo==='GOL') model.partida[body.time_id===10?'gols_mandante':'gols_visitante']++;
    model.auditoria.unshift({id,acao:'EVENTO_REGISTRADO',criado_em:new Date().toISOString(),dados:{request_id:body.request_id,evento_id:id}});
  }
  if (method==='DELETE') { const id=Number(endpoint.split('/').at(-1)); const e=model.eventos.find(e=>e.id===id); model.eventos=model.eventos.filter(e=>e.id!==id); if(e?.tipo==='GOL')model.partida[e.time_id===10?'gols_mandante':'gols_visitante']--; }
  if (endpoint.endsWith('/periodo')) model.partida.periodo_atual=body.periodo;
  if (endpoint.endsWith('/status')) model.partida.status=body.status;
  model.partida.versao++;
  if(window.fixture.loseResponse && endpoint.endsWith('/eventos')) {window.fixture.loseResponse=false;throw Error('resposta perdida após salvar');}
  if(window.fixture.delay) await new Promise(resolve=>setTimeout(resolve,window.fixture.delay));
  return new Response(JSON.stringify({ ok:true }));
}
`);
fs.writeFileSync(entry, `
import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import Sumula from '../../apps/mobile/src/components/SumulaPartida'; import {model} from './backend';
function App(){const [data,setData]=useState(structuredClone(model)); return <Sumula data={data} clubeId={1} connected onBack={()=>{}} onRefresh={async()=>{const next=structuredClone(model);setData(next);return next;}}/>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
const aliasModules = /^(expo-router|expo-secure-store|expo-linear-gradient|expo-clipboard|expo-sharing|expo-file-system\/legacy|react-native-safe-area-context)$/;
(async () => {
  await esbuild.build({ entryPoints:[entry], outfile:path.join(output,'bundle.js'), bundle:true, jsx:'automatic', platform:'browser', mainFields:['browser','module','main'], resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'], define:{__DEV__:'true','process.env.NODE_ENV':'"development"','process.env.EXPO_PUBLIC_DEBUG_PERF':'"0"'}, alias:{react: path.dirname(mobile.resolve('react/package.json')), 'react-dom':path.dirname(mobile.resolve('react-dom/package.json')), 'react-native':mobile.resolve('react-native-web'), 'react-native-svg':path.join(path.dirname(mobile.resolve('react-native-svg/package.json')),'src/ReactNativeSVG.web.ts')}, plugins:[{name:'isolate',setup(build){
    build.onResolve({filter:aliasModules},()=>({path:shim}));
    build.onResolve({filter:/contexts\/(ThemeContext|SessaoContext)$/},()=>({path:shim}));
    build.onResolve({filter:/(^|\/)api$/},args=>args.path === './api' || args.path.endsWith('/services/api') ? {path:backend} : undefined);
    build.onResolve({filter:/^@ludora\/icons$/},()=>({path:path.join(root,'packages/icons/src/index.ts')}));
    build.onResolve({filter:/^@ludora\/design-tokens$/},()=>({path:path.join(root,'packages/design-tokens/src/index.ts')}));
    build.onLoad({filter:/\.svg$/},()=>({contents:'export default function Logo(){return null}',loader:'tsx'}));
  }}] });
  const server=http.createServer((req,res)=>{if(req.url.startsWith('/bundle.js')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(output,'bundle.js')));}else res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body,#root{height:100%;margin:0;background:#0B0D12}*{box-sizing:border-box}</style></head><body><div id="root"></div><script>window.global=window;window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  let scenarios=0;
  try {
    for(const width of [320,390,600,900])for(const role of ['manager','staff-team','staff-elsewhere','guest','common','final','final-guest']){
      const page=await browser.newPage({viewport:{width,height:840}}), errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${url}/?${role}`);
      try { await page.getByText('Acontecimentos',{exact:true}).waitFor({timeout:7000}); }
      catch(error) { await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}); console.error({errors, text:await page.locator('body').innerText()}); throw error; }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}/${role}: overflow`);
      if(/guest|common/.test(role)) {
        for(const name of ['Registrar gol de Ocian','Fazer substituição','Finalizar partida','Histórico de alterações']) assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
      }
      if(role==='manager'||role==='staff-team'){
        assert.equal(await page.getByRole('radio').count(),0);
        assert.equal(await page.evaluate(()=>window.fixture.pollReads),0);
      }
      if(role==='staff-elsewhere'){
        await page.waitForFunction(()=>window.fixture.pollReads>0);
        await page.getByText('Quem você acha que vence?',{exact:true}).waitFor({state:'hidden'});
      }
      if(role==='guest'||role.startsWith('final')){
        await page.getByRole('radio').first().waitFor();
        assert.equal(await page.getByRole('radio',{disabled:true}).count(),3);
      }
      if(role.startsWith('final')) {await page.getByRole('button',{name:'Compartilhar resultado',exact:true}).click();await page.getByText('Incluir destaques',{exact:true}).waitFor();await page.getByRole('button',{name:'Fechar janela',exact:true}).last().click();}
      if(role==='common' && width===390){await page.getByRole('radio',{name:'Empate, 0% dos votos',exact:true}).click();await page.getByText('Palpite salvo. Você pode trocar até o encerramento.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.fixture.vote),'EMPATE');}
      await page.screenshot({path:path.join(output,`${role}-${width}.png`),fullPage:true});
      assert.deepEqual(errors,[],`${width}/${role}: runtime`);await page.close();scenarios++;
    }
    const periodPage=await browser.newPage({viewport:{width:320,height:840}});
    await periodPage.goto(`${url}/?manager`);
    await periodPage.getByRole('button',{name:'Tempo anterior',exact:true}).click();
    await periodPage.getByText('Voltar ao vivo',{exact:true}).waitFor();
    assert.equal(await periodPage.evaluate(()=>window.fixture.model.partida.periodo_atual),2,'voltar consulta sem alterar período oficial');
    assert.equal(await periodPage.evaluate(()=>window.fixture.writes.length),0);
    await periodPage.getByRole('button',{name:'Registrar gol de Ocian',exact:true}).click();
    assert.equal(await periodPage.getByText('Voltar ao vivo',{exact:true}).count(),0,'novo lance retorna ao tempo atual');
    await periodPage.waitForTimeout(400);
    await periodPage.screenshot({path:path.join(output,'goal-dialog-320.png')});
    const anonymous=await periodPage.getByRole('button',{name:'Registrar gol sem identificar agora',exact:true}).boundingBox();
    assert.ok(anonymous && anonymous.y+anonymous.height<=840-24,'registro sem autor respeita a área segura');
    assert.ok(anonymous && anonymous.x>=0 && anonymous.x+anonymous.width<=320,'ação não ultrapassa a tela estreita');
    await periodPage.getByText('Gol contra do Santos',{exact:true}).click();
    await periodPage.getByText('Quem fez o gol contra pelo Santos?',{exact:true}).waitFor();
    await periodPage.getByRole('button',{name:'Selecionar Atleta 2-1, camisa 2',exact:true}).waitFor();
    assert.equal(await periodPage.getByRole('button',{name:'Selecionar Atleta 1-1, camisa 2',exact:true}).count(),0,'gol contra mostra a autoria adversária');
    await periodPage.getByRole('button',{name:'Fechar janela',exact:true}).last().click();
    await periodPage.getByRole('button',{name:'Próximo tempo',exact:true}).click();
    await periodPage.getByText('Iniciar próximo tempo?',{exact:true}).waitFor();
    assert.equal(await periodPage.evaluate(()=>window.fixture.writes.length),0,'avanço depende de confirmação');
    await periodPage.getByRole('button',{name:'Voltar',exact:true}).last().click();
    assert.equal(await periodPage.evaluate(()=>window.fixture.model.partida.periodo_atual),2);
    await periodPage.getByRole('button',{name:'Próximo tempo',exact:true}).click();
    await periodPage.getByRole('button',{name:'Confirmar tempo',exact:true}).click();
    await periodPage.waitForFunction(()=>window.fixture.model.partida.periodo_atual===3);
    await periodPage.getByRole('button',{name:'Fazer substituição',exact:true}).click();
    await periodPage.waitForTimeout(400);
    await periodPage.screenshot({path:path.join(output,'substitution-320.png'),fullPage:true});
    const substitute=await periodPage.getByText('Fazer substituição',{exact:true}).last().boundingBox();
    assert.ok(substitute && substitute.y<100,'substituição aproveita a altura disponível');
    const footer=await periodPage.getByRole('button',{name:'Confirmar substituição',exact:true}).boundingBox();
    assert.ok(footer && footer.y+footer.height<=840-24,'ação acima da área segura');
    await periodPage.screenshot({path:path.join(output,'substitution-320.png'),fullPage:true});
    await periodPage.close();scenarios++;
    const page=await browser.newPage({viewport:{width:390,height:840}}); page.on('pageerror',e=>console.error('Queue UI:',e.message)); await page.goto(`${url}/?manager`);await page.getByRole('button',{name:'Registrar gol de Ocian',exact:true}).click();
    await page.getByRole('button',{name:'Selecionar Atleta 1-1, camisa 2',exact:true}).click();
    await page.waitForTimeout(300);await page.screenshot({path:path.join(output,'goal-dialog-390.png'),fullPage:true});
    await page.getByRole('button',{name:'Registrar gol',exact:true}).click();await page.getByRole('button',{name:'Cancelar Gol · Ocian',exact:true}).click();
    await page.waitForTimeout(5200);assert.equal(await page.evaluate(()=>window.fixture.writes.length),0,'cancelamento antes da publicação');
    await page.getByRole('button',{name:'Registrar gol de Ocian',exact:true}).click();await page.getByRole('button',{name:'Selecionar Atleta 1-1, camisa 2',exact:true}).click();await page.getByRole('button',{name:'Registrar gol',exact:true}).click();
    await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.fixture.writes.length),0);await page.evaluate(()=>window.pauseFixture());await page.waitForTimeout(5000);assert.equal(await page.evaluate(()=>window.fixture.writes.length),0,'saída pausa envio');
    await page.getByText('Retomar',{exact:true}).click();await page.waitForTimeout(5600);assert.equal(await page.evaluate(()=>window.fixture.writes.length),1);assert.equal(await page.evaluate(()=>window.fixture.model.partida.gols_mandante),1);
    await page.evaluate(()=>{window.fixture.loseResponse=true;});
    await page.getByRole('button',{name:'Registrar gol de Ocian',exact:true}).click();await page.getByRole('button',{name:'Selecionar Atleta 1-1, camisa 2',exact:true}).click();await page.getByRole('button',{name:'Registrar gol',exact:true}).click();
    await page.waitForTimeout(5600);assert.equal(await page.evaluate(()=>window.fixture.model.partida.gols_mandante),2);assert.equal(await page.getByText('Verificar',{exact:true}).count(),0,'resposta perdida reconciliada pela auditoria');
    await page.getByRole('button',{name:'Finalizar partida',exact:true}).click();await page.getByRole('button',{name:'Confirmar encerramento',exact:true}).click();await page.getByRole('button',{name:'Compartilhar resultado',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.fixture.model.partida.status),'FINALIZADA');
    await page.close();scenarios++;
    console.log(`${scenarios} cenários mobile passaram. Screenshots: ${output}`);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
