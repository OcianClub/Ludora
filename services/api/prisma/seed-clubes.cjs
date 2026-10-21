// Seed incremental: não apaga tabelas, não troca senhas existentes e não envia e-mail.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const folder = path.resolve(__dirname, '../../../.local-demo');
const subs = [7,8,9,10,12,14,16,18];
const clubNames = ['Ocian','Santos','Ludora FC'];
const baseName = name => name.replace(/\s*[-–—·(]?\s*sub[\s-]*\d{1,2}\)?\s*$/i,'').trim();

async function main() {
  const existing = await prisma.clube.findMany({ select:{id:true,nome:true,escudo:true} });
  console.log(JSON.stringify({mode:apply?'apply':'preview',clubes:existing,plano:'Renomear Jefferson → Santos, Ludora FC → Ocian; criar Ludora FC de demonstração; preservar partidas e usuários.'},null,2));
  if(!apply) return;
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,`clubes-antes-${Date.now()}.json`),JSON.stringify(existing,null,2));
  const credentialsPath = path.join(folder,'contas.json');
  const credentials = fs.existsSync(credentialsPath) ? JSON.parse(fs.readFileSync(credentialsPath,'utf8')) : [];
  const password = randomBytes(15).toString('base64url')+'aA1!';
  const hash = await bcrypt.hash(password,12);
  const result = await prisma.$transaction(async tx => {
    // Bancos preenchidos manualmente podem ter IDs à frente da sequência.
    // Só avança contadores; nunca reduz IDs nem altera registros existentes.
    for (const table of ['Clube','Categoria','Time','Jogador','Usuario','UsuarioClube','Competicao','Partida','Evento','EscalacaoPartida','CompeticaoTime','Notificacao']) {
      await tx.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 1), (SELECT last_value FROM "${table}_id_seq")), true)`);
    }
    if (!existing.some(c=>c.nome==='Ocian')) {
      const old = existing.filter(c=>c.nome==='Ludora FC');
      if(old.length!==1) throw new Error('Não foi possível identificar o Ludora FC original de forma única');
      await tx.clube.update({where:{id:old[0].id},data:{nome:'Ocian',plano:'DEMO'}});
      const own = await tx.time.findMany({where:{categoria:{clube_id:old[0].id}}});
      for(const time of own.filter(t=>baseName(t.nome)==='Ludora FC')) {
        await tx.time.update({where:{id:time.id},data:{nome:time.nome.replace('Ludora FC','Ocian'),clube_representado_id:old[0].id}});
      }
    }
    if (!existing.some(c=>c.nome==='Santos')) {
      const old = existing.filter(c=>['Jefferson','Clube Jefferson'].includes(c.nome));
      if(old.length!==1) throw new Error('Não foi possível identificar o clube Jefferson de forma única');
      await tx.clube.update({where:{id:old[0].id},data:{nome:'Santos',plano:'DEMO'}});
    }
    const clubs=[];
    for(const nome of clubNames) {
      const matches=await tx.clube.findMany({where:{nome}});
      if(matches.length>1) throw new Error('Clube duplicado: '+nome);
      clubs.push(matches[0] || await tx.clube.create({data:{nome,plano:'DEMO',cidade:'Praia Grande',estado:'SP'}}));
    }
    let games=0, players=0;
    for(const club of clubs) {
      const slug=club.nome.toLowerCase().replace(/\s/g,'');
      const cats=[];
      for(const age of subs) cats.push(await tx.categoria.upsert({where:{nome_clube_id:{nome:`sub-${age}`,clube_id:club.id}},update:{},create:{nome:`sub-${age}`,faixaIdade:age,tipo:age<=10?'INICIACAO':'BASE',clube_id:club.id}}));
      for(const [role,tag] of [['ADMIN','admin'],['TORCEDOR','visitante'],['TECNICO','tecnico'],['OLHEIRO','olheiro']]) {
        const email=`demo.${slug}.${tag}@example.test`;
        let user=await tx.usuario.findUnique({where:{email}});
        if(user && !user.nome.startsWith('Demo ')) throw new Error('Conta de demonstração colidiu com usuário existente');
        if(!user) { user=await tx.usuario.create({data:{nome:`Demo ${club.nome} ${tag}`,email,senha:hash}});credentials.push({email,senha:password,clube:club.nome,cargo:role}); }
        const member=await tx.usuarioClube.upsert({where:{usuario_id_clube_id:{usuario_id:user.id,clube_id:club.id}},update:{},create:{usuario_id:user.id,clube_id:club.id,papel:role,acesso_todas_categorias:role==='ADMIN'}});
        if(role==='TECNICO') await tx.usuarioClubeCategoria.upsert({where:{usuario_clube_id_categoria_id:{usuario_clube_id:member.id,categoria_id:cats[0].id}},update:{},create:{usuario_clube_id:member.id,categoria_id:cats[0].id}});
        // Cada visitante acompanha os três clubes, sem receber acesso de gestão.
        if(role==='TORCEDOR') for(const other of clubs) await tx.usuarioClube.upsert({where:{usuario_id_clube_id:{usuario_id:user.id,clube_id:other.id}},update:{},create:{usuario_id:user.id,clube_id:other.id,papel:'TORCEDOR'}});
      }
      for(const type of ['INICIACAO','BASE']) {
        const nome=`[DEMO] Copa ${club.nome} ${type==='BASE'?'Base':'Iniciação'}`;
        let comp=await tx.competicao.findFirst({where:{nome,clube_id:club.id}});
        if(!comp) comp=await tx.competicao.create({data:{nome,clube_id:club.id,ano:new Date().getUTCFullYear(),tipo:type,categorias:{connect:cats.filter(c=>c.tipo===type).map(c=>({id:c.id}))}}});
        for(const cat of cats.filter(c=>c.tipo===type)) {
          const teams=[];
          for(const name of [...clubNames,'Estrela Azul','Aurora FC','União Esportiva']) {
            const legacy=await tx.time.findMany({where:{categoria_id:cat.id}});
            let team=legacy.find(t=>baseName(t.nome)===name);
            if(!team) team=await tx.time.create({data:{nome:name,categoria_id:cat.id}});
            const represented=clubs.find(c=>c.nome===name);
            if(represented && team.clube_representado_id!==represented.id) {
              await tx.auditoriaVinculoTime.create({data:{time_id:team.id,clube_anterior_id:team.clube_representado_id,clube_novo_id:represented.id,motivo:'Seed explícita de demonstração solicitada pelo grupo'}});
              team=await tx.time.update({where:{id:team.id},data:{clube_representado_id:represented.id}});
            }
            teams.push(team);
            await tx.competicaoTime.upsert({where:{competicao_id_time_id:{competicao_id:comp.id,time_id:team.id}},update:{},create:{competicao_id:comp.id,time_id:team.id}});
          }
          const names=['James Walker','Ethan Brooks','Oliver Reed','Noah Carter','Liam Parker','Henry Scott','Mason Clark','Lucas Wilson','Leo Turner','Jack Morgan','Adam Hayes','Owen Baker','Daniel Young','Ryan Cooper','Dylan Hill','Luke Bennett'];
          const data=names.map((nome,i)=>({nome,cpf:`88${String(cat.id*100+i).padStart(9,'0')}`,dtNasc:new Date(Date.UTC(new Date().getUTCFullYear()-cat.faixaIdade,3,10)),numCamisa:null,posicao:['Goleiro','Fixo','Alas','Pivô'][i%4],categoria_id:cat.id}));
          players+=(await tx.jogador.createMany({data,skipDuplicates:true})).count;
          const roster=await tx.jogador.findMany({where:{cpf:{in:data.map(p=>p.cpf)}},orderBy:{id:'asc'}});
          const own=teams.find(t=>baseName(t.nome)===club.nome);
          const rival=teams.find(t=>clubNames.includes(baseName(t.nome))&&baseName(t.nome)!==club.nome);
          for(let i=0;i<8;i++) {
            const local=`[DEMO] ${club.nome} · ${cat.nome} · cenário ${i}`;
            if(await tx.partida.findFirst({where:{local,categoria_id:cat.id}})) continue;
            const date=new Date(); date.setUTCDate(date.getUTCDate()+[-28,-21,-14,-7,-1,0,3,7][i]);
            const home=i%2===0;
            const scored=i<6; const ownGoals=scored?[3,2,1,4,3,1][i]:0, awayGoals=scored?[1,2,3,1,0,0][i]:0;
            const match=await tx.partida.create({data:{categoria_id:cat.id,competicao_id:comp.id,mandante_id:home?own.id:rival.id,visitante_id:home?rival.id:own.id,emCasa:home,data:date,horario:'19:30',local,status:i<5?'FINALIZADA':i===5?'AO_VIVO':i===6?'PREPARADA':'AGENDADA',gols_mandante:home?ownGoals:awayGoals,gols_visitante:home?awayGoals:ownGoals}});
            games++;
            await tx.escalacaoPartida.createMany({data:roster.slice(0,10).map((p,index)=>({partida_id:match.id,jogador_id:p.id,numCamisa:index+1,titular:index<5}))});
            if(scored) await tx.evento.createMany({data:[...Array.from({length:ownGoals},(_,n)=>({partida_id:match.id,tipo:'GOL',periodo:1,minuto:3+n*2,jogador_id:roster[n+1].id})),...Array.from({length:awayGoals},(_,n)=>({partida_id:match.id,tipo:'GOL',periodo:2,minuto:4+n*3,jogador_id:null}))]});
          }
        }
      }
      const followers=await tx.usuarioClube.findMany({where:{clube_id:club.id},select:{usuario_id:true}});
      for(const member of followers) if(!await tx.notificacao.findFirst({where:{usuario_id:member.usuario_id,clube_id:club.id,titulo:'[DEMO] Calendário de testes disponível'}})) await tx.notificacao.create({data:{usuario_id:member.usuario_id,clube_id:club.id,tipo:'PARTIDA_AGENDADA',titulo:'[DEMO] Calendário de testes disponível',corpo:'Dados fictícios para conferir jogos, categorias e permissões.'}});
    }
    return {clubs:clubs.map(c=>({id:c.id,nome:c.nome})),games,players};
  },{timeout:240000,maxWait:10000});
  fs.writeFileSync(credentialsPath,JSON.stringify(credentials,null,2));
  console.log(JSON.stringify(result,null,2));
  console.log('Credenciais salvas em .local-demo/contas.json (ignorado pelo Git).');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
