// Dados exclusivamente do teste: intercepta o HTTP no navegador, sem banco.
exports.install = async function install(page, { role = 'ADMIN', playerCount = 8 } = {}) {
  const clubes=[{id:2,nome:'Ocian',meuPapel:role},{id:3,nome:'Santos',meuPapel:null},{id:4,nome:'Ludora FC',meuPapel:null}].map(c=>({...c,plano:'DEMO',cidade:'Praia Grande',estado:'SP'}));
  const usuario={id:1,nome:'Alex Morgan',email:'visual@example.test'};
  const categorias=[7,8,9,10,12,14,16,18].map((n,i)=>({id:i+1,nome:`sub-${n}`,faixaIdade:n,tipo:n<=10?'INICIACAO':'BASE',clube_id:2}));
  const times=categorias.flatMap(c=>['Aurora FC','Estrela Azul','Ludora FC','Ocian','Santos','União Esportiva'].map((nome,i)=>{
    const clube=clubes.find(club=>club.nome===nome);
    return {id:c.id*10+i,nome:`${nome} ${c.nome}`,categoria_id:c.id,clube_representado_id:clube?.id??null,clubeRepresentado:clube??null};
  }));
  const names=['Adam Hayes','Daniel Young','Dylan Hill','Ethan Brooks','James Walker','Liam Scott','Noah Lewis','Oliver King'];
  const jogadores=categorias.flatMap(c=>Array.from({length:playerCount},(_,i)=>({id:c.id*100+i,nome:names[i%8]+(i>=8?` ${Math.floor(i/8)+1}`:''),categoria_id:c.id,ativo:true,numCamisa:i?i:null,posicao:['Goleiro','Fixo','Pivô','Alas'][i%4],cpf:'',dtNasc:'2019-01-15',totalGols:i,totalAssistencias:1,totalPartidas:5})));
  const partidas=categorias.flatMap(c=>Array.from({length:8},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()+(i<5?-i-1:i-5));
    const mandante=times.find(t=>t.categoria_id===c.id&&t.clube_representado_id===2),visitante=times.find(t=>t.categoria_id===c.id&&t.clube_representado_id===(i%2?3:4));
    return {id:c.id*100+i,categoria:c,categoria_id:c.id,data:d.toISOString(),horario:'18:30',local:'Quadra de demonstração',mandante,visitante,mandante_id:mandante.id,visitante_id:visitante.id,gols_mandante:i%4,gols_visitante:1,status:i<5?'FINALIZADA':i===5?'AO_VIVO':i===6?'PREPARADA':'AGENDADA',emCasa:true,somente_leitura:false};
  }));
  const competicoes=[{id:1,nome:'[DEMO] Copa Ocian Base',tipo:'BASE',ano:2026,clube_id:2},{id:2,nome:'[DEMO] Copa Ocian Iniciação',tipo:'INICIACAO',ano:2026,clube_id:2}];
  const shared=partidas.find(p=>p.id===106);
  Object.assign(shared,{somente_leitura:true,clube_origem_id:3,categoria_id:99,categoria:{...shared.categoria,id:99,clube_id:3}});
  await page.route('http://localhost:3000/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const query=new URL(route.request().url()).searchParams;
    if(pathname==='/locais/sugestoes') return route.fulfill({json:{items:[{id:'local:demo',label:'Ginásio de demonstração',source:'local'}],providerEnabled:false,unavailable:false}});
    if(pathname==='/jogadores') {
      let rows=jogadores.filter(j=>(!query.get('categoria_id')||j.categoria_id===Number(query.get('categoria_id')))&&j.nome.toLowerCase().includes((query.get('busca')||'').toLowerCase())&&(!query.get('posicao')||j.posicao===query.get('posicao'))&&(!query.get('camisa')||(query.get('camisa')==='missing'?j.numCamisa==null:j.numCamisa!=null)));
      if(query.get('resumo')==='true')return route.fulfill({json:categorias.map(c=>{const group=rows.filter(j=>j.categoria_id===c.id);return {categoria_id:c.id,total:group.length,semCamisa:group.filter(j=>j.numCamisa==null).length};})});
      rows.sort((a,b)=>a.nome.localeCompare(b.nome)*(query.get('ordem')==='desc'?-1:1));
      if(query.has('limite'))rows=rows.slice(Number(query.get('offset')||0),Number(query.get('offset')||0)+Number(query.get('limite')));
      return route.fulfill({json:rows.map(row=>({...row,totalPartidas:5}))});
    }
    if(pathname==='/jogadores/categoria')return route.fulfill({json:{categoria:categorias[0],temporada:2026}});
    const playerMatch=pathname.match(/^\/jogadores\/(\d+)(?:\/(partidas|campeonatos))?$/);
    if(playerMatch){
      const player=jogadores.find(j=>j.id===Number(playerMatch[1]));
      if(!player)return route.fulfill({status:404,json:{error:'Jogador não encontrado'}});
      if(route.request().method()==='PATCH'){Object.assign(player,route.request().postDataJSON());return route.fulfill({json:player});}
      if(playerMatch[2]){const items=playerMatch[2]==='partidas'?partidas.slice(0,5):competicoes;return route.fulfill({json:{items,total:items.length,pagina:Number(query.get('pagina')||1),porPagina:20}});}
      return route.fulfill({json:{...player,...(['ADMIN','TECNICO'].includes(role)?{cpf:'12345678901'}:{cpf:undefined}),categoria:categorias.find(c=>c.id===player.categoria_id),podeEditar:['ADMIN','TECNICO','MESARIO'].includes(role),totalPartidas:5,totalCompeticoes:2,partidas:partidas.slice(0,3),campeonatos:competicoes}});
    }
    if(pathname==='/clube/perfil')return route.fulfill({json:{...clubes[0],endereco:{logradouro:'Rua de demonstração',numero:'10',bairro:'Centro',cidade:'Praia Grande',estado:'SP',cep:'11700000',complemento:''}}});
    const gameMatch=pathname.match(/^\/partidas\/(\d+)$/);
    if(gameMatch&&route.request().method()==='PATCH'){const match=partidas.find(p=>p.id===Number(gameMatch[1]));Object.assign(match,route.request().postDataJSON());return route.fulfill({json:match});}
    if(pathname==='/usuarios/me/notificacoes'&&route.request().method()==='PATCH'){
      const ativa=JSON.parse(route.request().postData()||'{}').ativa;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ativa})});
    }
    const responses={
      '/auth/login':{token:'visual-test-only',usuario},'/usuarios/me':{...usuario,notificacoes_ativas:true,clubes},'/clubes':clubes,'/categorias':categorias,'/times':times,
      '/jogadores':jogadores,'/jogadores/perfis':jogadores,'/partidas':partidas,'/partidas/home':partidas,'/competicoes':competicoes,
      '/membros':[{id:1,usuario,papel:'ADMIN',acesso_todas_categorias:true,categorias:[]},{id:2,usuario:{id:2,nome:'James Walker'},papel:'TORCEDOR',acesso_todas_categorias:false,categorias:[]}],
      '/notificacoes':{totalNaoLidas:1,notificacoes:[{id:1,titulo:'Partida ao vivo',corpo:'Dados controlados de teste visual.',lida:false,partida_id:105,criada_em:new Date().toISOString()}]},
    };
    if(pathname==='/socket.io/')return route.fulfill({status:400,body:'Test without socket server'});
    const body=responses[pathname]??(pathname.endsWith('/escalacao')?[{jogador_id:900,numCamisa:10,titular:true,jogador:{nome:'James Walker',posicao:'Fixo',numCamisa:10}}]:pathname.endsWith('/eventos')?[{id:1,partida_id:106,tipo:'GOL',periodo:1,jogador_id:900,jogador:{id:900,nome:'James Walker'}}]:undefined);
    if(body===undefined) throw new Error(`Fixture sem endpoint: ${pathname}`);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
};
