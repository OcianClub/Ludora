// Verificação de leitura e negação de acesso contra a API local e a seed real.
// Não altera cargos, partidas ou vínculos; nunca imprime senhas/tokens.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const accounts=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../.local-demo/contas.json'),'utf8'));
async function request(endpoint, token, club, method='GET', body) {
  return fetch('http://localhost:3000'+endpoint,{method,signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(club?{'x-clube-id':String(club)}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
(async()=>{
  const sessions={};
  for(const role of ['ADMIN','TORCEDOR','OLHEIRO','TECNICO']) {
    const account=accounts.find(a=>a.clube==='Ocian'&&a.cargo===role);
    const login=await request('/auth/login',null,null,'POST',{email:account.email,senha:account.senha});
    assert.equal(login.status,200,`Login demo ${role}`);const {token}=await login.json();
    const profile=await request('/usuarios/me',token);assert.equal(profile.status,200);
    const club=(await profile.json()).clubes.find(c=>c.nome==='Ocian');assert.ok(club);
    sessions[role]={token,club:club.id};
    const members=await request('/membros',token,club.id);
    assert.equal(members.status,role==='ADMIN'?200:403,`Lista de membros para ${role}`);
    if(role!=='ADMIN')assert.equal((await request('/times/vinculo',token,club.id,'PATCH',{})).status,403);
  }
  const {token,club}=sessions.ADMIN;
  const response=await request('/partidas?resumo=1',token,club);assert.equal(response.status,200);
  const matches=await response.json();assert.ok(matches.some(p=>p.somente_leitura));
  const shared=matches.find(p=>p.somente_leitura);
  const detail=await request(`/partidas/${shared.id}`,token,club);assert.equal(detail.status,200);
  const viewed=await detail.json();assert.equal(viewed.id,shared.id);assert.equal(viewed.somente_leitura,true);
  assert.equal(viewed.emCasa,shared.emCasa);
  assert.equal((await request(`/partidas/${shared.id}/status`,token,club,'PATCH',{status:'PREPARADA'})).status,403);
  assert.ok(matches.some(p=>!p.somente_leitura));
  console.log('PASS API real: quatro cargos, lista administrativa restrita, vínculo negado a não administradores e histórico compartilhado consultável sem permissão de escrita.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
