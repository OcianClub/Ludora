import { useCallback, useEffect, useState } from 'react';
import type { StatusBanco, StatusSistema } from '@ludora/shared-types';
import { Btn, DesktopSection, DesktopState, LoadingSkeleton } from '../components/AdminUI';
import { AdminIcon } from '../components/AdminIcon';
import { Icon } from '@web/components/Icon';
import { fetchStatusBanco, fetchStatusSistema } from '../services/api';

const duracao = (s: number) => s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min`;
const numero = (n: number) => n.toLocaleString('pt-BR');
const GRUPOS = [
  { titulo: 'Clubes e elenco', tabelas: { clubes: 'Clubes', usuarios: 'Usuários', vinculos: 'Vínculos', categorias: 'Categorias', times: 'Times', jogadores: 'Jogadores' } },
  { titulo: 'Competições e partidas', tabelas: { competicoes: 'Competições', partidas: 'Partidas', eventos: 'Eventos', escalacoes: 'Escalações' } },
  { titulo: 'Comunicação', tabelas: { notificacoes: 'Notificações', convites: 'Convites', dispositivos: 'Dispositivos' } },
];
const tabelasConhecidas = new Set(GRUPOS.flatMap(g => Object.keys(g.tabelas)));

function Estado({ status, texto }: { status: 'ok' | 'atencao' | 'falha' | 'neutro'; texto: string }) {
  return <span className={`estado estado-${status}`}><AdminIcon name={status === 'ok' ? 'check' : status === 'falha' || status === 'atencao' ? 'alert' : 'info'} size={16}/>{texto}</span>;
}

export default function BancoPage() {
  const [banco, setBanco] = useState<StatusBanco | null>(null);
  const [sistema, setSistema] = useState<StatusSistema | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [consultadoEm, setConsultadoEm] = useState<Date | null>(null);

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

  return <div className="desktop-system-page desktop-bank-page">
    <div className="page-header">
      <div><h1 className="page-title">Banco e integrações</h1><p className="page-sub">Saúde dos serviços e estrutura da plataforma.</p></div>
      <div className="desktop-bank-refresh">
        <span role="status">{carregando ? 'Verificando serviços…' : erro ? 'Consulta incompleta' : 'Consulta concluída'}
          {consultadoEm && <time dateTime={consultadoEm.toISOString()}>Última verificação · {consultadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>}
        </span>
        <Btn variant="ghost" onClick={() => void carregar()} disabled={carregando}><Icon name="refresh" size={16}/>{carregando ? 'Verificando…' : 'Verificar agora'}</Btn>
      </div>
    </div>
    {erro && <DesktopState error title="Não foi possível consultar todos os serviços" description={`${erro}${banco || sistema ? ' · Os últimos dados disponíveis continuam visíveis.' : ''}`} onRetry={() => void carregar()}/>}
    {carregando && !banco && !sistema && <LoadingSkeleton kind="stats" label="Verificando banco e integrações" count={3}/>}

    {banco && <DesktopSection title="Banco de dados" className="desktop-bank-health">
      <div className="desktop-bank-health-grid">
        <div className="desktop-bank-connection">
          <span className="desktop-bank-icon"><AdminIcon name="database" size={25}/></span>
          <div><Estado status={banco.conectado ? 'ok' : 'falha'} texto={banco.conectado ? 'Banco conectado' : 'Banco desconectado'}/>
            <p>{banco.versaoPostgres}</p></div>
          <strong className="desktop-bank-latency">{numero(banco.latenciaMs)}<small>ms</small></strong>
        </div>
        <dl className="desktop-bank-migrations">
          <div><dt>Migrações aplicadas</dt><dd>{numero(banco.migracoes.aplicadas)}</dd><small>{banco.migracoes.locais !== null ? `${numero(banco.migracoes.locais)} neste build` : 'Comparação com o build indisponível'}</small></div>
          <div data-state={pendentes?.length ? 'atencao' : undefined}><dt>Pendentes</dt><dd>{pendentes == null ? '—' : numero(pendentes.length)}</dd>{pendentes == null && <small>Não verificadas</small>}</div>
          <div data-state={falhas.length ? 'falha' : undefined}><dt>Com falha</dt><dd>{numero(falhas.length)}</dd></div>
        </dl>
      </div>
      {!!pendentes?.length && <div className="desktop-bank-migration-alert" role="alert"><Estado status="atencao" texto="Há migrações pendentes"/><p>{pendentes.join(', ')}</p></div>}
      {!!falhas.length && <div className="desktop-bank-migration-alert" role="alert"><Estado status="falha" texto="Há migrações com falha"/><p>{falhas.join(', ')}</p></div>}
    </DesktopSection>}

    {sistema && <>
      <DesktopSection title="Integrações" description="Disponibilidade e configuração dos serviços conectados.">
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
      <DesktopSection title="Servidor">
        <dl className="desktop-bank-server">
          {[['Ambiente', sistema.ambiente], ['Node', sistema.node], ['Tempo em execução', duracao(sistema.uptimeSegundos)], ['Memória', `${numero(sistema.memoriaMB)} MB`], ['Conexões app/web', numero(sistema.conexoes.principal)]].map(([nome, valor]) => <div key={nome}><dt>{nome}</dt><dd>{valor}</dd></div>)}
        </dl>
      </DesktopSection>
    </>}

    {banco && <DesktopSection title="Registros por tabela" description="Contagens no momento da consulta, organizadas por área.">
      <div className="desktop-bank-records">
        {GRUPOS.map(grupo => <div key={grupo.titulo}><h3>{grupo.titulo}</h3><dl>{Object.entries(grupo.tabelas).filter(([nome]) => nome in banco.tabelas).map(([nome, rotulo]) => <div key={nome}><dt>{rotulo}</dt><dd>{numero(banco.tabelas[nome])}</dd></div>)}</dl></div>)}
        {!!extras.length && <div><h3>Outros registros</h3><dl>{extras.map(([nome, total]) => <div key={nome}><dt>{nome}</dt><dd>{numero(total)}</dd></div>)}</dl></div>}
      </div>
    </DesktopSection>}
  </div>;
}
