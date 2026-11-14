import { useCallback, useEffect, useState } from 'react';
import type { StatusBanco, StatusSistema } from '@ludora/shared-types';
import { Btn, DesktopSection, DesktopState, LoadingSkeleton } from '../components/AdminUI';
import { AdminIcon } from '../components/AdminIcon';
import { Icon } from '@web/components/Icon';
import { fetchStatusBanco, fetchStatusSistema } from '../services/api';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { DesktopTable } from '../components/DesktopTable';
import { DesktopAccordion } from '../components/DesktopAccordion';
import './Banco.css';

const duracao = (s: number) => s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min`;
const numero = (n: number) => n.toLocaleString('pt-BR');
const GRUPOS = [
  { titulo: 'Clubes e elenco', tabelas: { clubes: 'Clubes', usuarios: 'Usuários', vinculos: 'Vínculos', categorias: 'Categorias', times: 'Times', jogadores: 'Jogadores' } },
  { titulo: 'Competições e partidas', tabelas: { competicoes: 'Competições', partidas: 'Partidas', eventos: 'Eventos', escalacoes: 'Escalações' } },
  { titulo: 'Comunicação', tabelas: { notificacoes: 'Notificações', convites: 'Convites', dispositivos: 'Dispositivos' } },
];
const tabelasConhecidas = new Set(GRUPOS.flatMap(g => Object.keys(g.tabelas)));

function Estado({ status, texto }: { status: 'ok' | 'atencao' | 'falha' | 'neutro'; texto: string }) {
  return <span className="bank-status" data-state={status}><span aria-hidden="true"/>{texto}</span>;
}

export default function BancoPage() {
  const [banco, setBanco] = useState<StatusBanco | null>(null);
  const [sistema, setSistema] = useState<StatusSistema | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [consultadoEm, setConsultadoEm] = useState<Date | null>(null);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    const [b, s] = await Promise.allSettled([fetchStatusBanco(), fetchStatusSistema()]);
    if (b.status === 'fulfilled') setBanco(b.value);
    if (s.status === 'fulfilled') setSistema(s.value);
    setErro([
      b.status === 'rejected' ? `Banco: ${b.reason instanceof Error ? b.reason.message : 'consulta indisponível'}` : '',
      s.status === 'rejected' ? `Servidor e integrações: ${s.reason instanceof Error ? s.reason.message : 'consulta indisponível'}` : '',
    ].filter(Boolean).join(' · '));
    setConsultadoEm(new Date()); setCarregando(false);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const pendentes = banco?.migracoes.pendentes;
  const falhas = banco?.migracoes.falhas ?? [];
  const scout = sistema?.integracoes.scoutIA;
  const extras = banco ? Object.entries(banco.tabelas).filter(([nome]) => !tabelasConhecidas.has(nome)) : [];
  const registros = banco ? [...GRUPOS.flatMap(grupo => Object.entries(grupo.tabelas).filter(([nome])=>nome in banco.tabelas).map(([nome,label])=>({nome,label,area:grupo.titulo,total:banco.tabelas[nome]}))),
    ...extras.map(([nome,total])=>({nome,label:nome,area:'Outros registros',total}))] : [];
  const normalizar = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const registrosVisiveis = registros.filter(r=>normalizar(`${r.label} ${r.nome} ${r.area}`).includes(normalizar(busca.trim())));

  return <div className="desktop-system-page desktop-bank-page">
    <div className="page-header">
      <div><span className="ticket-kicker">Infraestrutura da plataforma</span><h1 className="page-title">Banco e integrações</h1><p className="page-sub">Acompanhe a conexão, os serviços e a estrutura dos dados.</p></div>
      <div className="desktop-bank-refresh">
        <span role="status">{carregando ? 'Verificando serviços…' : erro ? 'Consulta incompleta' : 'Consulta concluída'}
          {consultadoEm && <time dateTime={consultadoEm.toISOString()}>Última verificação · {consultadoEm.toLocaleTimeString('pt-BR', { timeZone:'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>}
        </span>
        <Btn variant="ghost" onClick={() => void carregar()} loading={carregando}>{!carregando && <Icon name="refresh" size={16}/>} {carregando ? 'Verificando…' : 'Verificar agora'}</Btn>
      </div>
    </div>
    {erro && <DesktopState error title="Não foi possível consultar todos os serviços" description={`${erro}${banco || sistema ? ' · Os últimos dados disponíveis continuam visíveis.' : ''}`} onRetry={() => void carregar()}/>}
    {carregando && !banco && !sistema && <LoadingSkeleton kind="stats" label="Verificando banco e integrações" count={3}/>}

    {banco && <DesktopSection title="Banco de dados" className="desktop-bank-health" description="Conexão e migrações da API.">
      <div className="desktop-bank-health-grid">
        <div className="desktop-bank-connection">
          <span className="desktop-bank-icon"><AdminIcon name="database" size={25}/></span>
          <div><Estado status={banco.conectado ? 'ok' : 'falha'} texto={banco.conectado ? 'Banco conectado' : 'Banco desconectado'}/>
            <p>{banco.versaoPostgres}</p></div>
          <strong className="desktop-bank-latency">{numero(banco.latenciaMs)}<small>ms</small></strong>
        </div>
        <dl className="desktop-bank-migrations">
          <div><dt>Migrações aplicadas</dt><dd>{numero(banco.migracoes.aplicadas)}</dd><small>{banco.migracoes.locais !== null ? `${numero(banco.migracoes.locais)} no build atual` : 'Comparação com o build indisponível'}</small></div>
          <div data-state={pendentes?.length ? 'atencao' : undefined}><dt>Pendentes</dt><dd>{pendentes == null ? '—' : numero(pendentes.length)}</dd>{pendentes == null && <small>Não verificadas</small>}</div>
          <div data-state={falhas.length ? 'falha' : undefined}><dt>Com falha</dt><dd>{numero(falhas.length)}</dd></div>
        </dl>
      </div>
      {!!pendentes?.length && <div className="desktop-bank-migration-alert" role="alert"><Estado status="atencao" texto="Há migrações pendentes"/><DesktopAccordion title="Ver migrações pendentes"><ul>{pendentes.map(v=><li key={v}>{v}</li>)}</ul></DesktopAccordion></div>}
      {!!falhas.length && <div className="desktop-bank-migration-alert" role="alert"><Estado status="falha" texto="Há migrações com falha"/><DesktopAccordion title="Ver migrações com falha"><ul>{falhas.map(v=><li key={v}>{v}</li>)}</ul></DesktopAccordion></div>}
    </DesktopSection>}

    {sistema && <>
      <DesktopSection title="Integrações" className="bank-integrations-section" description="Condição atual de cada serviço conectado.">
        <div className="desktop-bank-integrations">
          <article><header><span className="desktop-bank-icon"><AdminIcon name="radar" size={21}/></span><h3>Scout IA <small>Python</small></h3></header>
            <Estado status={!scout?.configurado ? 'atencao' : scout.acessivel === true ? 'ok' : scout.acessivel === false ? 'falha' : 'neutro'}
              texto={!scout?.configurado ? 'Não configurado' : scout.acessivel === true ? `Respondendo${scout.ms != null ? ` · ${numero(scout.ms)} ms` : ''}` : scout.acessivel === false ? 'Não respondeu à verificação' : 'Disponibilidade não verificada'}/>
            <p>Consulta ao serviço de saúde.</p>
          </article>
          <article><header><span className="desktop-bank-icon"><Icon name="email" size={21}/></span><h3>E-mail <small>Resend</small></h3></header>
            <Estado status={sistema.integracoes.email.configurado ? 'neutro' : 'atencao'} texto={sistema.integracoes.email.configurado ? 'Configurado' : 'Não configurado'}/>
            <p>{sistema.integracoes.email.configurado ? 'Envio não verificado nesta consulta.' : 'O envio de e-mails depende da configuração.'}</p>
          </article>
          <article><header><span className="desktop-bank-icon"><AdminIcon name="database" size={21}/></span><h3>Armazenamento <small>Supabase</small></h3></header>
            <Estado status={sistema.integracoes.supabaseStorage.configurado ? 'neutro' : 'atencao'} texto={sistema.integracoes.supabaseStorage.configurado ? 'Configurado' : 'Não configurado'}/>
            <p>{sistema.integracoes.supabaseStorage.configurado ? 'Upload não verificado nesta consulta.' : 'O armazenamento depende da configuração.'}</p>
          </article>
        </div>
      </DesktopSection>
      <DesktopSection title="Servidor" className="bank-server-section">
        <dl className="desktop-bank-server">
          {[['Ambiente', sistema.ambiente], ['Node', sistema.node], ['Tempo em execução', duracao(sistema.uptimeSegundos)], ['Memória', `${numero(sistema.memoriaMB)} MB`], ['Conexões app/web', numero(sistema.conexoes.principal)]].map(([nome, valor]) => <div key={nome}><dt>{nome}</dt><dd>{valor}</dd></div>)}
        </dl>
      </DesktopSection>
    </>}

    {banco && <DesktopSection title="Registros por tabela" className="bank-records-section" description="Contagens no momento da consulta. A busca não acessa o conteúdo dos registros.">
      <CollectionSearch label="Buscar tabelas" placeholder="Buscar tabela ou área…" value={busca} onChange={setBusca}/>
      <p className="bank-record-count">{registrosVisiveis.length} de {registros.length} tabelas</p>
      {registrosVisiveis.length ? <DesktopTable label="Registros por tabela" tableClassName="bank-records-table">
        <thead><tr><th scope="col">Tabela</th><th scope="col">Área</th><th scope="col">Registros</th></tr></thead>
        <tbody>{registrosVisiveis.map(r=><tr key={r.nome}><td><strong>{r.label}</strong></td><td>{r.area}</td><td>{numero(r.total)}</td></tr>)}</tbody>
      </DesktopTable> : <DesktopState plain icon="search" title="Nenhuma tabela encontrada" description="Experimente outro nome ou área."/>}
    </DesktopSection>}
  </div>;
}
