// Actual RN Web screen, isolated publication/API and native navigation. No writes to live systems.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),mobile=createRequire(path.join(root,'apps/mobile/package.json'));
const esbuild=createRequire(fs.realpathSync(path.join(root,'apps/web/node_modules/vite/package.json')))('esbuild');
const output=path.join(root,'test-results/mobile-support-notices');fs.mkdirSync(output,{recursive:true});
const shim=path.join(output,'shim.tsx'),backend=path.join(output,'backend.ts'),entry=path.join(output,'entry.tsx');
fs.writeFileSync(shim,`
import React,{useEffect} from 'react';import {ScrollView,Text,View,TouchableOpacity} from 'react-native';import {darkColors} from '../../packages/design-tokens/src';
export default {expoConfig:{version:'test'}};
export const usePathname=()=>'/inicio';
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
window.socketHandlers={};window.emitSupport=event=>{for(const fn of [...(window.socketHandlers[event]||[])])fn({chamadoId:'one'});};export const io=()=>{const all=[];return {on(event,fn){(window.socketHandlers[event]??=[]).push(fn);all.push([event,fn]);if(event==='connect')setTimeout(fn,1);},disconnect(){for(const[event,fn]of all)window.socketHandlers[event]=window.socketHandlers[event].filter(f=>f!==fn);}};};
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
export const BASE_URL='/isolated';
window.noticesFixture={reads:0,ack:0,reply:10,active:true,fail:false,pauses:[]};
export async function apiFetch(url,options={}){
 const f=window.noticesFixture;f.reads++;
 if(options.method==='PATCH'){f.ack=Math.max(f.ack,JSON.parse(options.body).respostaId);window.emitSupport('avisos_suporte_atualizados');return new Response('{}');}
 if(url==='/manutencao/estado')return new Response(JSON.stringify(f.pauses));
 if(f.fail)return new Response('{}',{status:503});
 return new Response(JSON.stringify(f.active&&f.reply>f.ack?[{id:f.reply,chamadoId:'one'}]:[]));
}
`);
fs.writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {Text,TouchableOpacity} from 'react-native';import {AssistanceProvider,useAssistance} from '../../apps/mobile/src/contexts/AssistanceContext';import {AssistanceStatus} from '../../apps/mobile/src/components/AssistanceStatus';function Status(){const {replies,seen}=useAssistance();return <><Text>Respostas: {replies}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Ler resposta antiga" onPress={()=>seen('one',10)}><Text>Ler</Text></TouchableOpacity><AssistanceStatus/></>};let root=createRoot(document.getElementById('root'));const render=()=>root.render(<AssistanceProvider><Status/></AssistanceProvider>);render();window.remount=()=>{root.unmount();root=createRoot(document.getElementById('root'));render();};`);
(async()=>{
await esbuild.build({entryPoints:[entry],outfile:path.join(output,'bundle.js'),bundle:true,jsx:'automatic',platform:'browser',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],define:{__DEV__:'true','process.env.NODE_ENV':'"development"'},alias:{react:path.dirname(mobile.resolve('react/package.json')),'react-dom':path.dirname(mobile.resolve('react-dom/package.json')),'react-native':mobile.resolve('react-native-web'),'react-native-svg':path.join(path.dirname(mobile.resolve('react-native-svg/package.json')),'src/ReactNativeSVG.web.ts')},plugins:[{name:'isolation',setup(b){
b.onResolve({filter:/^(expo-router|expo-secure-store|expo-constants|expo-file-system\/legacy|expo-linear-gradient|socket.io-client|react-native-safe-area-context)$/},()=>({path:shim}));
b.onResolve({filter:/(ThemeContext|SessaoContext|ClubeAtivoContext)$/},()=>({path:shim}));
b.onResolve({filter:/components\/(Header|HeaderClube|CarrosselSubs|CategoryPager)$/},()=>({path:shim}));
b.onResolve({filter:/hooks\/useCategoryPagerMotion$/},()=>({path:shim}));
b.onResolve({filter:/services\/api$/},()=>({path:backend}));
b.onResolve({filter:/^@ludora\/icons$/},()=>({path:path.join(root,'packages/icons/src/index.ts')}));
b.onResolve({filter:/^@ludora\/design-tokens$/},()=>({path:path.join(root,'packages/design-tokens/src/index.ts')}));
}}]});


const server=http.createServer((req,res)=>{if(req.url.startsWith('/bundle.js')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(output,'bundle.js')));}else res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script>window.global=window;window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:390,height:840}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/?manager`);
await page.getByText('Respostas: 1',{exact:true}).waitFor();
await page.getByRole('button',{name:'Ler resposta antiga'}).click();await page.getByText('Respostas: 0',{exact:true}).waitFor();await page.waitForFunction(()=>window.noticesFixture.ack===10);
const before=await page.evaluate(()=>window.noticesFixture.reads);await page.evaluate(()=>window.remount());await page.waitForFunction(before=>window.noticesFixture.reads>=before+2,before);await page.getByText('Respostas: 0',{exact:true}).waitFor();
await page.evaluate(()=>{window.noticesFixture.reply=11;window.emitSupport('resposta_suporte');});await page.getByText('Respostas: 1',{exact:true}).waitFor();
await page.getByRole('button',{name:'Ler resposta antiga'}).click();assert.equal(await page.getByText('Respostas: 1',{exact:true}).count(),1);
await page.evaluate(()=>{window.noticesFixture.fail=true;window.emitSupport('avisos_suporte_atualizados');});await page.waitForTimeout(100);assert.equal(await page.getByText('Respostas: 1',{exact:true}).count(),1);
await page.evaluate(()=>{window.noticesFixture.fail=false;window.noticesFixture.active=false;window.emitSupport('avisos_suporte_atualizados');});await page.getByText('Respostas: 0',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Novas respostas do suporte'}).count(),0);
await page.evaluate(()=>{window.noticesFixture.pauses=[{operacao:'TESTE',label:'Consulta',motivo:'Em manutenção',escopo:'GLOBAL'}];window.emitSupport('avisos_suporte_atualizados');});await page.getByRole('button',{name:'Funções em manutenção',exact:true}).waitFor();
await page.getByRole('button',{name:'Funções em manutenção',exact:true}).click();await page.getByText('Consulta em manutenção',{exact:true}).waitFor();
await page.evaluate(()=>{window.noticesFixture.pauses=[];window.emitSupport('avisos_suporte_atualizados');});await page.getByText('Consulta em manutenção',{exact:true}).waitFor({state:'hidden'});
assert.deepEqual(errors,[]);console.log('PASS: persistent read receipts, new replies, stale reads, network failure, closed/deleted tickets and independent maintenance notices');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
