// Dados exclusivamente do teste: intercepta o HTTP no navegador, sem banco.
exports.install = async function install(page, { role = 'ADMIN' } = {}) {
  const clubes=[{id:2,nome:'Ocian',meuPapel:role},{id:3,nome:'Santos',meuPapel:null},{id:4,nome:'Ludora FC',meuPapel:null}].map(c=>({...c,plano:'DEMO',cidade:'Praia Grande',estado:'SP'}));
  const usuario={id:1,nome:'Alex Morgan',email:'visual@example.test'};
  const categorias=[7,8,9,10,12,14,16,18].map((n,i)=>({id:i+1,nome:`sub-${n}`,faixaIdade:n,tipo:n<=10?'INICIACAO':'BASE',clube_id:2}));
  const times=categorias.flatMap(c=>['Aurora FC','Estrela Azul','Ludora FC','Ocian','Santos','União Esportiva'].map((nome,i)=>{
    const clube=clubes.find(club=>club.nome===nome);
    return {id:c.id*10+i,nome:`${nome} ${c.nome}`,categoria_id:c.id,clube_representado_id:clube?.id??null,clubeRepresentado:clube??null};
  }));
  const jogadores=categorias.flatMap(c=>['Adam Hayes','Daniel Young','Dylan Hill','Ethan Brooks','James Walker','Liam Scott','Noah Lewis','Oliver King'].map((nome,i)=>({id:c.id*100+i,nome,categoria_id:c.id,ativo:true,numCamisa:i?i:null,posicao:['Goleiro','Fixo','Pivô','Alas'][i%4],cpf:'',dtNasc:'2019-01-15',totalGols:i,totalAssistencias:1,totalPartidas:5})));
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
