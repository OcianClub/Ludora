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
const output = path.join(root, 'test-results/mobile-match-sync'); fs.mkdirSync(output, { recursive: true });
const shim = path.join(output, 'native-shim.tsx'), backend = path.join(output, 'backend.ts'), entry = path.join(output, 'entry.tsx');
fs.writeFileSync(shim, `
import React from 'react'; import { View } from 'react-native';
import { darkColors } from '../../packages/design-tokens/src';
const listeners = new Map();
export const useClubeAtivo=()=>({clubeAtivo:{id:1,nome:'Ocian',papel:'ADMIN'},podeGerenciar:true});
window.socketCallbacks={}; window.emitMatch=(event,data)=>{for(const fn of window.socketCallbacks[event]||[])fn(data)};
export const io=()=>{const handlers=[];const socket={connected:true,on(event,fn){(window.socketCallbacks[event]??=[]).push(fn);handlers.push([event,fn]);if(event==='connect')setTimeout(fn,10);return socket;},disconnect(){for(const[event,fn]of handlers)window.socketCallbacks[event]=window.socketCallbacks[event].filter(f=>f!==fn);}};return socket;};
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
fs.writeFileSync(backend,`
export const BASE_URL='/isolated';
export const invalidarConsultasRecentes=()=>{};
window.matchFixture={reads:0,fail:false,model:{partida:{id:1,status:'PREPARADA',versao:1},equipes:[{escalacao:[]}],podePreparar:true}};
export async function gestaoPartida(){window.matchFixture.reads++;if(window.matchFixture.fail)throw Error('Sem conexão');return structuredClone(window.matchFixture.model);}
export async function requisicaoPartida(){return {pendentes:0};}
export async function apiFetch(){return new Response('{}');}
`);
fs.writeFileSync(path.join(output,'empty.tsx'),`export default function Empty(){return null;}`);
fs.writeFileSync(path.join(output,'prep.tsx'),`import {Text} from 'react-native';export default function Prep({data}){return <Text>Preparação: {data.partida.versao}, {data.equipes[0].escalacao.length} atletas</Text>;}`);
fs.writeFileSync(path.join(output,'live.tsx'),`import {Text} from 'react-native';export default function Live({data}){return <Text>Ao vivo: {data.partida.versao}</Text>;}`);
fs.writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import Match from '../../apps/mobile/src/components/PartidaCompartilhada';createRoot(document.getElementById('root')).render(<Match id={1} onBack={()=>{}}/>);`);
const aliasModules = /^(socket.io-client|expo-router|expo-secure-store|expo-linear-gradient|expo-clipboard|expo-sharing|expo-file-system\/legacy|react-native-safe-area-context)$/;
(async () => {
  await esbuild.build({ entryPoints:[entry], loader:{'.png':'dataurl'}, outfile:path.join(output,'bundle.js'), bundle:true, jsx:'automatic', platform:'browser', mainFields:['browser','module','main'], resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'], define:{__DEV__:'true','process.env.NODE_ENV':'"development"','process.env.EXPO_PUBLIC_DEBUG_PERF':'"0"'}, alias:{react: path.dirname(mobile.resolve('react/package.json')), 'react-dom':path.dirname(mobile.resolve('react-dom/package.json')), 'react-native':mobile.resolve('react-native-web'), 'react-native-svg':path.join(path.dirname(mobile.resolve('react-native-svg/package.json')),'src/ReactNativeSVG.web.ts')}, plugins:[{name:'isolate',setup(build){
    build.onResolve({filter:/\/partidasCompartilhadas$/},()=>({path:backend}));
    build.onResolve({filter:/SolicitacoesPartidas$/},()=>({path:path.join(output,'empty.tsx')}));
    build.onResolve({filter:/^\.\/PreparacaoPartida$/},()=>({path:path.join(output,'prep.tsx')}));
    build.onResolve({filter:/^\.\/SumulaPartida$/},()=>({path:path.join(output,'live.tsx')}));
    build.onResolve({filter:aliasModules},()=>({path:shim}));
    build.onResolve({filter:/contexts\/(ThemeContext|SessaoContext|ClubeAtivoContext)$/},()=>({path:shim}));
    build.onResolve({filter:/(^|\/)api$/},args=>args.path === './api' || args.path.endsWith('/services/api') ? {path:backend} : undefined);
    build.onResolve({filter:/^@ludora\/icons$/},()=>({path:path.join(root,'packages/icons/src/index.ts')}));
    build.onResolve({filter:/^@ludora\/design-tokens$/},()=>({path:path.join(root,'packages/design-tokens/src/index.ts')}));
    build.onLoad({filter:/\.svg$/},()=>({contents:'export default function Logo(){return null}',loader:'tsx'}));
  }}] });

const server=http.createServer((req,res)=>{if(req.url.startsWith('/bundle.js'))res.end(fs.readFileSync(path.join(output,'bundle.js')));else res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script>window.global=window;window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try { for(const width of [320,820]) {
const page=await browser.newPage({viewport:{width,height:840}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.getByText('Preparação: 1, 0 atletas',{exact:true}).waitFor();await page.waitForTimeout(150);
const before=await page.evaluate(()=>window.matchFixture.reads);await page.evaluate(()=>window.emitMatch('partida_atualizada',{id:99}));await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.matchFixture.reads),before);
await page.evaluate(()=>{window.matchFixture.model.equipes[0].escalacao=[{jogador_id:1}];window.matchFixture.model.partida.versao=2;window.emitMatch('partida_atualizada',{id:1});});
await page.getByText('Preparação: 2, 1 atletas',{exact:true}).waitFor();
await page.evaluate(()=>{window.marker='same-screen';window.matchFixture.model.partida={id:1,status:'AO_VIVO',versao:3};window.emitMatch('partida_atualizada',{id:1});});
await page.getByText('Ao vivo: 3',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.marker),'same-screen');
await page.evaluate(()=>{window.matchFixture.model.partida={id:1,status:'PREPARADA',versao:1};window.emitMatch('partida_atualizada',{id:1});});await page.waitForTimeout(200);assert.equal(await page.getByText('Ao vivo: 3',{exact:true}).count(),1,'old snapshot cannot restore preparation');
await page.evaluate(()=>{window.matchFixture.model.partida={id:1,status:'AO_VIVO',versao:4};window.emitMatch('connect',{});});await page.getByText('Ao vivo: 4',{exact:true}).waitFor();
assert.deepEqual(errors,[]);await page.close();console.log(`PASS mobile realtime ${width}: roster, live transition, reconnect, stale version, irrelevant match`);
}}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
