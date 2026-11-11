// Actual RN Web screen, isolated publication/API and native navigation. No writes to live systems.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),mobile=createRequire(path.join(root,'apps/mobile/package.json'));
const esbuild=createRequire(fs.realpathSync(path.join(root,'apps/web/node_modules/vite/package.json')))('esbuild');
const output=path.join(root,'test-results/mobile-paulista');fs.mkdirSync(output,{recursive:true});
const shim=path.join(output,'shim.tsx'),backend=path.join(output,'backend.ts'),entry=path.join(output,'entry.tsx');
fs.writeFileSync(shim,`
import React,{useEffect} from 'react';import {Text,View,TouchableOpacity} from 'react-native';import {darkColors} from '../../packages/design-tokens/src';
export const useTheme=()=>({colors:darkColors,tema:'dark'});
export const useSessao=()=>({autenticado:!location.search.includes('guest')});
window.switchClub=id=>window.dispatchEvent(new CustomEvent('fixture-club',{detail:id}));
export function useClubeAtivo(){const[id,setId]=React.useState(1);useEffect(()=>{const fn=e=>setId(e.detail);window.addEventListener('fixture-club',fn);return()=>window.removeEventListener('fixture-club',fn);},[]);return {clubeAtivo:{id,nome:id===1?'Ocian':'Santos',escudo:null}};}
export const useSafeAreaInsets=()=>({top:0,bottom:24,left:0,right:0});export const SafeAreaView=View,LinearGradient=View;
export const useFocusEffect=fn=>useEffect(fn,[fn]);export const useRouter=()=>({push(){},back(){}});
export const getItemAsync=async()=>location.search.includes('guest')?null:'isolated-token';
export const io=()=>({on(){},removeAllListeners(){},disconnect(){}});
export const HeaderClube=()=> <View style={{height:54,padding:12}}><Text style={{color:'#fff'}}>Ocian</Text></View>;
export const SUBS_INICIACAO=[7,8,9,10].map(n=>({title:'SUB-'+n})),SUBS_BASE=[12,14,16,18].map(n=>({title:'SUB-'+n}));
export function CarrosselSubs(p){const subs=p.tipoFiltro==='INICIACAO'?SUBS_INICIACAO:SUBS_BASE;return <View style={{padding:12,gap:8}}><View style={{flexDirection:'row'}}>{['INICIACAO','BASE'].map(t=><TouchableOpacity key={t} accessibilityRole='button' accessibilityLabel={t} onPress={()=>p.onTrocarTipo(t)} style={{flex:1,padding:8}}><Text style={{color:'#fff'}}>{t}</Text></TouchableOpacity>)}</View><View style={{flexDirection:'row'}}>{subs.map((s,i)=><TouchableOpacity key={s.title} accessibilityRole='button' accessibilityLabel={s.title} onPress={()=>p.onChangeIndex(i)} style={{flex:1,padding:8}}><Text style={{color:'#fff'}}>{s.title}</Text></TouchableOpacity>)}</View></View>;}
`);
fs.writeFileSync(backend,`
import {paulistaFixture} from '../../apps/mobile/tests/paulista.fixture';
export const BASE_URL='/isolated';window.fixture={requests:[],fail:false,delay:0};
export async function apiFetch(url,opts={}){window.fixture.requests.push({url,method:opts.method||'GET'});if(window.fixture.delay)await new Promise(r=>setTimeout(r,window.fixture.delay));if(window.fixture.fail)throw Error('isolated offline');const data=paulistaFixture();return new Response(JSON.stringify(data));}
`);
fs.writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import Screen from '../../apps/mobile/src/screens/PaulistaScreen';createRoot(document.getElementById('root')).render(<Screen/>);`);
(async()=>{
await esbuild.build({entryPoints:[entry],outfile:path.join(output,'bundle.js'),bundle:true,jsx:'automatic',platform:'browser',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],define:{__DEV__:'true','process.env.NODE_ENV':'"development"'},alias:{react:path.dirname(mobile.resolve('react/package.json')),'react-dom':path.dirname(mobile.resolve('react-dom/package.json')),'react-native':mobile.resolve('react-native-web'),'react-native-svg':path.join(path.dirname(mobile.resolve('react-native-svg/package.json')),'src/ReactNativeSVG.web.ts')},plugins:[{name:'isolation',setup(b){
b.onResolve({filter:/^(expo-router|expo-secure-store|expo-linear-gradient|socket.io-client|react-native-safe-area-context)$/},()=>({path:shim}));
b.onResolve({filter:/contexts\/(ThemeContext|SessaoContext|ClubeAtivoContext)$/},()=>({path:shim}));
b.onResolve({filter:/components\/(HeaderClube|CarrosselSubs)$/},()=>({path:shim}));
b.onResolve({filter:/services\/api$/},()=>({path:backend}));
b.onResolve({filter:/^@ludora\/icons$/},()=>({path:path.join(root,'packages/icons/src/index.ts')}));
b.onResolve({filter:/^@ludora\/design-tokens$/},()=>({path:path.join(root,'packages/design-tokens/src/index.ts')}));
}}]});
const fontFiles={Inter_400Regular:'inter/400Regular/Inter_400Regular.ttf',Inter_600SemiBold:'inter/600SemiBold/Inter_600SemiBold.ttf',Inter_700Bold:'inter/700Bold/Inter_700Bold.ttf',Oswald_600SemiBold:'oswald/600SemiBold/Oswald_600SemiBold.ttf'};
const fonts=Object.keys(fontFiles).map(f=>`@font-face{font-family:${f};src:url(/fonts/${f})}`).join('');
const server=http.createServer((req,res)=>{if(req.url.startsWith('/bundle.js')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(output,'bundle.js')));}else if(req.url.startsWith('/fonts/')){const f=req.url.slice(7);res.end(fs.readFileSync(path.join(root,'apps/mobile/node_modules/@expo-google-fonts',fontFiles[f])));}else res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${fonts}html,body,#root{height:100%;margin:0;background:#0B0D12}*{box-sizing:border-box}</style></head><body><div id="root"></div><script>window.global=window;window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></body></html>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});let count=0;
try{for(const width of [320,360,390,600,900])for(const role of ['guest','manager']){
const page=await browser.newPage({viewport:{width,height:840}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${url}/?${role}`);
try{await page.getByText('Eliminado na semifinal',{exact:true}).waitFor({timeout:10000});}catch(e){console.error(errors,await page.locator('body').innerText());throw e;}
await page.evaluate(()=>document.fonts.ready);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}/${role} page overflow`);
await page.screenshot({path:path.join(output,`overview-${role}-${width}.png`),fullPage:true});
await page.getByRole('button',{name:'Selecionar temporada: 2026',exact:true}).click();
await page.getByRole('radio',{name:'Temporada 2025',exact:true}).click();
await page.getByText('Chave a confirmar',{exact:true}).waitFor();
await page.getByRole('button',{name:'Selecionar temporada: 2025',exact:true}).click();await page.getByRole('radio',{name:'Temporada 2026',exact:true}).click();
await page.getByText('Eliminado na semifinal',{exact:true}).waitFor();
await page.getByRole('button',{name:'SUB-9',exact:true}).click();await page.getByText('Nenhuma participação publicada para SUB-9 na temporada 2026.',{exact:true}).waitFor();
await page.getByRole('button',{name:'SUB-7',exact:true}).click();
await page.getByRole('tab',{name:'Classificação',exact:true}).click();await page.getByRole('button',{name:'Localizar meu clube',exact:true}).waitFor();
assert.equal(await page.getByText('Chave Ouro',{exact:true}).count(),1);assert.equal(await page.getByText('Chave Bronze',{exact:true}).count(),1);
await page.screenshot({path:path.join(output,`standings-${role}-${width}.png`),fullPage:true});
await page.getByRole('button',{name:/Selecionar etapa:/}).click();await page.getByRole('radio',{name:'Fase de classificação',exact:true}).click();
const stats=page.getByLabel('Estatísticas oficiais. Deslize para consultar todas as colunas.',{exact:true});
// Accessible spelling is source-normalized; select by prefix instead.
const first=page.getByLabel(/^1º, /).first(),before=await first.boundingBox();
await stats.evaluate(e=>{e.scrollLeft=250;e.dispatchEvent(new Event('scroll'));});
const after=await first.boundingBox();assert.equal(before.x,after.x,'identity columns remain pinned');
await page.getByRole('button',{name:'Localizar meu clube',exact:true}).click();
await page.waitForTimeout(350);assert.equal(await stats.evaluate(e=>e.scrollLeft),0,'locate also restores stats scroll');
const scrollBefore=await page.locator('body').evaluate(()=>Array.from(document.querySelectorAll('*')).filter(e=>e.scrollHeight>e.clientHeight+30&&getComputedStyle(e).overflowY==='auto').map(e=>e.scrollTop));
await page.getByRole('button',{name:'Selecionar temporada: 2026',exact:true}).evaluate(e=>e.click());
await page.getByRole('button',{name:'Fechar menu',exact:true}).click();
assert.deepEqual(await page.locator('body').evaluate(()=>Array.from(document.querySelectorAll('*')).filter(e=>e.scrollHeight>e.clientHeight+30&&getComputedStyle(e).overflowY==='auto').map(e=>e.scrollTop)),scrollBefore,'dropdown does not move content');
await page.getByRole('button',{name:'Sobre a classificação oficial',exact:true}).click();
await page.getByText('Posições e pontos conforme a federação, sem recálculo pelo Ludora.',{exact:false}).waitFor();
assert.equal(await page.evaluate(()=>window.fixture.requests.every(r=>r.method==='GET')),true,'public screen read-only');
assert.deepEqual(errors,[],`${width}/${role} runtime`);await page.close();count++;
}
const page=await browser.newPage({viewport:{width:390,height:840}});await page.goto(`${url}/?guest`);await page.getByText('Eliminado na semifinal',{exact:true}).waitFor();
await page.getByRole('button',{name:'Opções do campeonato',exact:true}).click();await page.getByRole('button',{name:'Atualizar dados',exact:true}).waitFor();
await page.evaluate(()=>{window.fixture.delay=500;window.fixture.fail=true;});
await page.getByRole('button',{name:'Atualizar dados',exact:true}).click();await page.getByText('Última atualização não concluída',{exact:true}).waitFor();
assert.equal(await page.getByText('Eliminado na semifinal',{exact:true}).count(),1,'refresh failure preserves publication');
await page.screenshot({path:path.join(output,'refresh-error.png'),fullPage:true});await page.close();count++;
const race=await browser.newPage({viewport:{width:360,height:840}});await race.goto(`${url}/?guest`);await race.getByText('Eliminado na semifinal',{exact:true}).waitFor();
await race.getByRole('button',{name:/Ver partida:/}).first().click();await race.getByText('Partida oficial',{exact:true}).waitFor();
await race.evaluate(()=>{window.fixture.delay=500;window.switchClub(2);});
await race.getByText('Partida oficial',{exact:true}).waitFor({state:'hidden'});
await race.getByText('Santos · SUB-7 · Divisão A2',{exact:true}).waitFor();
assert.equal(await race.getByText('Ocian · SUB-7 · Divisão A2',{exact:true}).count(),0,'previous club publication cannot leak into selected club');
await race.close();count++;
console.log(JSON.stringify({scenarios:count,output}));
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
