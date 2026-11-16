// Actual RN Web screen, isolated publication/API and native navigation. No writes to live systems.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),mobile=createRequire(path.join(root,'apps/mobile/package.json'));
const esbuild=createRequire(fs.realpathSync(path.join(root,'apps/web/node_modules/vite/package.json')))('esbuild');
const output=path.join(root,'test-results/mobile-support-check');fs.mkdirSync(output,{recursive:true});
const shim=path.join(output,'shim.tsx'),backend=path.join(output,'backend.ts'),entry=path.join(output,'entry.tsx');
fs.writeFileSync(shim,`
import React,{useEffect} from 'react';import {ScrollView,Text,View,TouchableOpacity} from 'react-native';import {darkColors} from '../../packages/design-tokens/src';
export default {expoConfig:{version:'test'}};
export const useLocalSearchParams=()=>({tela:'/jogos'});
export const Redirect=()=>null;
export const documentDirectory='memory://';window.draftFiles={};
export const getInfoAsync=async p=>({exists:p in window.draftFiles});
export const readAsStringAsync=async p=>window.draftFiles[p];
export const writeAsStringAsync=async(p,s)=>{window.draftFiles[p]=s};
export const useAssistance=()=>{const[v,set]=React.useState(0);useEffect(()=>{const fn=()=>set(n=>n+1);window.addEventListener('fixture-support',fn);return()=>window.removeEventListener('fixture-support',fn);},[]);const seen=React.useCallback(()=>{},[]);return {seen,version:v};};
export const Header=({title})=><Text>{title}</Text>;
export const useTheme=()=>({colors:darkColors,tema:'dark'});
export const useSessao=()=>({autenticado:!location.search.includes('guest')});
window.switchClub=id=>window.dispatchEvent(new CustomEvent('fixture-club',{detail:id}));
export function useClubeAtivo(){const[id,setId]=React.useState(1);useEffect(()=>{const fn=e=>setId(e.detail);window.addEventListener('fixture-club',fn);return()=>window.removeEventListener('fixture-club',fn);},[]);return {clubeAtivo:{id,nome:id===1?'Ocian':'Santos',escudo:null}};}
export const useSafeAreaInsets=()=>({top:0,bottom:24,left:0,right:0});export const SafeAreaView=View,LinearGradient=View;
export function useFocusEffect(fn){
  const[focused,setFocused]=React.useState(true);
  useEffect(()=>{const onFocus=e=>setFocused(e.detail);window.addEventListener('fixture-focus',onFocus);return()=>window.removeEventListener('fixture-focus',onFocus);},[]);
  useEffect(()=>focused?fn():undefined,[focused,fn]);
}
window.setFixtureFocus=focused=>window.dispatchEvent(new CustomEvent('fixture-focus',{detail:focused}));export const useRouter=()=>({push(){},back(){}});
export const getItemAsync=async key=>key==='userEmail'?'test@ludora.test':'isolated-token';
export const io=()=>({on(){},removeAllListeners(){},disconnect(){}});
export const HeaderClube=()=> <View style={{height:54,padding:12}}><Text style={{color:'#fff'}}>Ocian</Text></View>;
export function useCategoryPagerMotion(pager){
  const goTo=React.useCallback(index=>pager.current?.setPage(index),[pager]);
  return {goTo,onSettled(){}};
}
export const CategoryPager=React.forwardRef(function CategoryPager({children,initialPage,onPageSelected},ref){
  const [active,setActive]=React.useState(initialPage);
  React.useImperativeHandle(ref,()=>({setPage(index){setActive(index);onPageSelected({nativeEvent:{position:index}});}}));
  return <View style={{flex:1,minHeight:0}}>{React.Children.toArray(children)[active]}</View>;
});
export function CategoryFilterScroll({activateOnStart,...props}){return <ScrollView {...props} horizontal />;}
export const SUBS_INICIACAO=[7,8,9,10].map(n=>({title:'SUB-'+n})),SUBS_BASE=[12,14,16,18].map(n=>({title:'SUB-'+n}));
export function CarrosselSubs(p){const subs=p.tipoFiltro==='INICIACAO'?SUBS_INICIACAO:SUBS_BASE;return <View style={{padding:12,gap:8}}><View style={{flexDirection:'row'}}>{['INICIACAO','BASE'].map(t=><TouchableOpacity key={t} accessibilityRole='button' accessibilityLabel={t} onPress={()=>p.onTrocarTipo(t)} style={{flex:1,padding:8}}><Text style={{color:'#fff'}}>{t}</Text></TouchableOpacity>)}</View><View style={{flexDirection:'row'}}>{subs.map((s,i)=><TouchableOpacity key={s.title} accessibilityRole='button' accessibilityLabel={s.title} onPress={()=>p.onChangeIndex(i)} style={{flex:1,padding:8}}><Text style={{color:'#fff'}}>{s.title}</Text></TouchableOpacity>)}</View></View>;}
`);
fs.writeFileSync(backend,`
window.supportFixture={requests:[],tickets:[]};
export async function apiFetch(url,options={}) {
 const f=window.supportFixture,body=options.body?JSON.parse(options.body):null;
 f.requests.push({url,method:options.method||'GET',body});
 if(options.method==='POST'&&url==='/suporte') {const ticket={id:'isolated-id',assunto:body.assunto,descricao:body.descricao,status:'NOVO',historico:[]};f.tickets.push(ticket);return new Response(JSON.stringify(ticket),{status:201});}
 if(options.method==='POST') {f.tickets[0].historico.push({id:2,acao:'RESPOSTA_CLIENTE',motivo:body.mensagem,criadoEm:new Date().toISOString()});return new Response('{}');}
 return new Response(JSON.stringify(url==='/suporte'?f.tickets:f.tickets[0]));
}
`);
fs.writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import Screen from '../../apps/mobile/app/suporte';let root=createRoot(document.getElementById('root'));root.render(<Screen/>);window.remount=()=>{root.unmount();root=createRoot(document.getElementById('root'));root.render(<Screen/>);};`);
(async()=>{
await esbuild.build({entryPoints:[entry],outfile:path.join(output,'bundle.js'),bundle:true,jsx:'automatic',platform:'browser',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],define:{__DEV__:'true','process.env.NODE_ENV':'"development"'},alias:{react:path.dirname(mobile.resolve('react/package.json')),'react-dom':path.dirname(mobile.resolve('react-dom/package.json')),'react-native':mobile.resolve('react-native-web'),'react-native-svg':path.join(path.dirname(mobile.resolve('react-native-svg/package.json')),'src/ReactNativeSVG.web.ts')},plugins:[{name:'isolation',setup(b){
b.onResolve({filter:/^(expo-router|expo-secure-store|expo-constants|expo-file-system\/legacy|expo-linear-gradient|socket.io-client|react-native-safe-area-context)$/},()=>({path:shim}));
b.onResolve({filter:/contexts\/(ThemeContext|SessaoContext|ClubeAtivoContext|AssistanceContext)$/},()=>({path:shim}));
b.onResolve({filter:/components\/(Header|HeaderClube|CarrosselSubs|CategoryPager)$/},()=>({path:shim}));
b.onResolve({filter:/hooks\/useCategoryPagerMotion$/},()=>({path:shim}));
b.onResolve({filter:/services\/api$/},()=>({path:backend}));
b.onResolve({filter:/^@ludora\/icons$/},()=>({path:path.join(root,'packages/icons/src/index.ts')}));
b.onResolve({filter:/^@ludora\/design-tokens$/},()=>({path:path.join(root,'packages/design-tokens/src/index.ts')}));
}}]});

const server=http.createServer((req,res)=>{if(req.url.startsWith('/bundle.js')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(output,'bundle.js')));}else res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script>window.global=window;window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try {for(const width of [320,390,820]){
const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?manager`);
await page.getByLabel('Assunto',{exact:true}).fill('Problema ao consultar partida');
await page.getByLabel('Descrição do chamado',{exact:true}).fill('Não consigo visualizar os detalhes da partida.');
await page.getByText('Rascunho salvo neste dispositivo.',{exact:false}).waitFor();
await page.evaluate(()=>window.remount());await page.getByLabel('Assunto',{exact:true}).waitFor();
await page.waitForFunction(()=>document.querySelector('input[aria-label="Assunto"]')?.value==='Problema ao consultar partida');
await page.getByRole('button',{name:/Tipo de ajuda:/}).click();
await page.getByRole('radio',{name:'Erro ou lentidão',exact:true}).click();
await page.getByRole('button',{name:'Enviar chamado',exact:true}).click();
await page.getByText('Problema ao consultar partida',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>window.supportFixture.requests.filter(r=>r.method==='POST').length),1);
assert.equal(await page.evaluate(()=>window.supportFixture.requests.find(r=>r.method==='POST').body.servico),'web');
await page.evaluate(()=>{window.supportFixture.tickets[0].historico.push({id:1,acao:'COMENTAR',motivo:'Estamos trabalhando na solução.',criadoEm:new Date().toISOString()});window.dispatchEvent(new Event('fixture-support'));});
await page.getByText('Estamos trabalhando na solução.',{exact:true}).waitFor();
await page.getByLabel('Responder ao suporte',{exact:true}).fill('Acontece também em outro jogo.');
await page.getByRole('button',{name:'Enviar resposta',exact:true}).click();await page.getByText('Acontece também em outro jogo.',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.screenshot({path:path.join(output,`support-${width}.png`),fullPage:true});assert.deepEqual(errors,[]);await page.close();}
console.log('PASS: support drafts, ticket creation, replies, live updates, responsive 320/390/820');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
