// Real mobile profile and game list rendered with RN Web; only native services are isolated.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { createRequire } = require('node:module'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..'), mobile = createRequire(path.join(root, 'apps/mobile/package.json'));
const esbuild = createRequire(fs.realpathSync(path.join(root, 'apps/web/node_modules/vite/package.json')))('esbuild');
const output = path.join(root, 'test-results/mobile-profile-games'); fs.mkdirSync(output, { recursive: true });
const shim = path.join(output, 'shim.tsx'), backend = path.join(output, 'backend.ts'), entry = path.join(output, 'entry.tsx');
fs.writeFileSync(shim, `
import React,{useEffect} from 'react';import {View,Text,ScrollView,TouchableOpacity} from 'react-native';import {lightColors,darkColors} from '../../packages/design-tokens/src';
export default function Empty(){return null;}export const ConfirmacaoConta=Empty,PreferenciasNotificacoes=Empty,FiltrosJogos=Empty;
export const useTheme=()=>({colors:location.search.includes('dark')?darkColors:lightColors,tema:location.search.includes('dark')?'dark':'light',preferenciaTema:'system',definirPreferenciaTema:async()=>{}});
const clubeAtivo={id:1,nome:'Ocian',papel:'ADMIN',escudo:null};export const useClubeAtivo=()=>({clubeAtivo,podeGerenciar:true,limparClubeAtivo:async()=>{}});
export const useSessao=()=>({autenticado:true,carregando:false});export const useNotificacoes=()=>({notificacoesAtivas:false,alterarNotificacoes:async()=>true});
export const router={navigate:path=>window.destination=path,push:path=>window.destination=path,replace:path=>window.destination=path,back(){}};export const useRouter=()=>router;
export const useLocalSearchParams=()=>({});export function useFocusEffect(fn){useEffect(fn,[fn]);}
export const useSafeAreaInsets=()=>({top:0,bottom:24,left:0,right:0});export const SafeAreaView=View;
const values={userName:'Ana do clube',userEmail:'ana@exemplo.test',userCriadoEm:'2026-01-01T12:00:00Z',userToken:'test'};
export const getItemAsync=async key=>values[key]??null,setItemAsync=async(key,value)=>values[key]=value,deleteItemAsync=async key=>delete values[key];
export const HeaderClube=()=> <View style={{height:50}}><Text>Ocian</Text></View>;export const Header=HeaderClube;
export const limparCacheConsultas=async()=>{};export const requisicaoPartida=async()=>({pendentes:0});
export const io=()=>({on(){return this},off(){},disconnect(){},removeAllListeners(){}});
export const SUBS_INICIACAO=[7,8,9,10].map(n=>({id:String(n),title:'SUB-'+n})),SUBS_BASE=[12,14,16,18].map(n=>({id:String(n),title:'SUB-'+n}));
export function CarrosselSubs(p){return <View style={{flexDirection:'row'}}>{(p.tipoFiltro==='INICIACAO'?SUBS_INICIACAO:SUBS_BASE).map((s,i)=><TouchableOpacity key={s.id} accessibilityRole="button" accessibilityLabel={s.title} onPress={()=>p.onChangeIndex(i)}><Text>{s.title}</Text></TouchableOpacity>)}</View>;}
export const CategoryPager=React.forwardRef(function Pager({children,initialPage,onPageSelected},ref){const [active,set]=React.useState(initialPage);React.useImperativeHandle(ref,()=>({setPage(index){set(index);onPageSelected({nativeEvent:{position:index}});}}));return <View style={{flex:1,minHeight:0}}>{React.Children.toArray(children)[active]}</View>;});
export function CategoryFilterScroll({activateOnStart,...p}){return <ScrollView horizontal {...p}/>;}export function CategoryPageMotion({children}){return children;}
export const useCategoryPagerMotion=ref=>({goTo:index=>ref.current?.setPage(index),onSettled(){}});
`);
fs.writeFileSync(backend, `
export const BASE_URL='/isolated';export const invalidarConsultasRecentes=()=>{},desvincularDispositivoPush=async()=>{},excluirConta=async()=>{};
export const atualizarUsuario=async data=>{window.savedProfile=data;return data;};export const fetchClubes=async()=>[{id:1,nome:'Ocian',papel:'ADMIN'}];
export const fetchAgenda=async()=>[...Array.from({length:16},(_,i)=>({id:i+1,status:'PREPARADA',grupo_agenda:'agenda',posicao:i+1,total_grupo:16,data:'2026-11-20T12:00:00Z',horario:'14:00',categoria:{id:7,nome:'SUB-7'},mandante:{id:1,nome:'Ocian',escudo:null},visitante:{id:2,nome:'Santos',escudo:null},gols_mandante:0,gols_visitante:0,local:'Ginásio Municipal',emCasa:true})),{id:100,status:'AGENDADA',grupo_agenda:'pendentes',posicao:1,total_grupo:1,data:'2020-01-01',horario:'14:00',categoria:{id:7,nome:'SUB-7'},mandante:{id:1,nome:'Ocian',escudo:null},visitante:{id:2,nome:'Santos',escudo:null},gols_mandante:0,gols_visitante:0,local:'Ginásio Municipal',emCasa:true}];
`);
fs.writeFileSync(entry, `import React from 'react';import {createRoot} from 'react-dom/client';import Profile from '../../apps/mobile/app/(tabs)/perfil/perfil';import Games from '../../apps/mobile/app/(tabs)/jogos/jogos';createRoot(document.getElementById('root')).render(location.pathname==='/games'?<Games/>:<Profile/>);`);
(async () => {
  await esbuild.build({ entryPoints:[entry], outfile:path.join(output,'bundle.js'), bundle:true, jsx:'automatic', platform:'browser', mainFields:['browser','module','main'], resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'], define:{__DEV__:'true','process.env.NODE_ENV':'"development"'}, alias:{react:path.dirname(mobile.resolve('react/package.json')),'react-dom':path.dirname(mobile.resolve('react-dom/package.json')),'react-native':mobile.resolve('react-native-web'),'react-native-svg':path.join(path.dirname(mobile.resolve('react-native-svg/package.json')),'src/ReactNativeSVG.web.ts'),'@':path.join(root,'apps/mobile')}, plugins:[{name:'isolate-native',setup(b){
    b.onResolve({filter:/^(expo-router|expo-secure-store|socket.io-client|react-native-safe-area-context)$/},()=>({path:shim}));
    b.onResolve({filter:/contexts\/(ThemeContext|SessaoContext|ClubeAtivoContext|NotificacoesContext)$/},()=>({path:shim}));
    b.onResolve({filter:/components\/(Header|HeaderClube|CarrosselSubs|CategoryPager|CategoryPageMotion|DetalhesPartida|PerfilVisitante|ConfirmacaoConta|PreferenciasNotificacoes|FiltrosJogos)$/},()=>({path:shim}));
    b.onResolve({filter:/hooks\/useCategoryPagerMotion$|services\/(cacheConsultas|partidasCompartilhadas)$/},()=>({path:shim}));
    b.onResolve({filter:/services\/api$/},()=>({path:backend}));
    b.onResolve({filter:/^@ludora\/icons$/},()=>({path:path.join(root,'packages/icons/src/index.ts')}));
    b.onResolve({filter:/^@ludora\/design-tokens$/},()=>({path:path.join(root,'packages/design-tokens/src/index.ts')}));
  }}] });
  const server=http.createServer((req,res)=>{if(req.url.startsWith('/bundle.js')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(output,'bundle.js')));}else res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body,#root{height:100%;margin:0}#root{display:flex}*{box-sizing:border-box}</style></head><body><div id="root"></div><script>window.global=window;window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></body></html>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
  try { for(const width of [320,390,820]) { for(const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height:840}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/profile?${theme}`);
    await page.getByText('ana@exemplo.test',{exact:true}).waitFor();
    const identity=await page.getByText('Ana do clube',{exact:true}).boundingBox(),fields=await page.getByText('Dados pessoais',{exact:true}).boundingBox();assert.ok(identity.y<fields.y,'identity precedes form');
    await page.getByText('Segurança da conta',{exact:true}).waitFor();
    await page.getByText('Precisa de ajuda?',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`profile-${width}-${theme}.png`),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'profile has no horizontal overflow');
    await page.getByRole('button',{name:/Suporte e ajuda/}).click();assert.equal(await page.evaluate(()=>window.destination),'/suporte');
    await page.getByRole('tab',{name:/Preferências/}).click();await page.getByText('Aparência',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/Suporte e ajuda/}).count(),1,'help is shared across tabs');
    await page.goto(`http://127.0.0.1:${server.address().port}/games?${theme}`);
    await page.getByText('Próximas',{exact:true}).first().waitFor();
    await page.getByRole('tab',{name:/^Atrasadas/}).click();
    const overdue=page.getByText('Atrasada',{exact:true});await overdue.waitFor();
    assert.equal(await overdue.evaluate(e=>getComputedStyle(e).color),theme==='light'?'rgb(166, 83, 19)':'rgb(240, 184, 78)');
    assert.equal(await overdue.evaluate(e=>getComputedStyle(e).fontSize),'10px');
    await page.screenshot({path:path.join(output,`overdue-${width}-${theme}.png`),fullPage:true});
    await page.getByRole('tab',{name:/^Próximas/}).click();
    assert.equal(await page.getByText('Atrasada',{exact:true}).count(),0,'Upcoming excludes overdue matches');

    await page.waitForFunction(()=>Array.from(document.querySelectorAll('*')).some(e=>e.scrollHeight>e.clientHeight+900&&getComputedStyle(e).overflowY==='auto'));
    await page.evaluate(()=>{const e=Array.from(document.querySelectorAll('*')).find(e=>e.scrollHeight>e.clientHeight+900&&getComputedStyle(e).overflowY==='auto');window.gamesScroll=e;e.scrollTop=1100;e.dispatchEvent(new Event('scroll'));});
    await page.getByRole('button',{name:'Voltar ao topo',exact:true}).click();await page.waitForFunction(()=>window.gamesScroll.scrollTop<10);
    await page.getByRole('button',{name:'Voltar ao topo',exact:true}).waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);await page.close();console.log(`PASS profile hierarchy, help, preferences and games scroll-to-top ${width} ${theme}`);
  } } } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
