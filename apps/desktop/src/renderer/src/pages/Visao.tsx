import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VisaoGlobal } from '@ludora/shared-types';
import { ClubBadge } from '@web/components/Brand';
import { Btn, LoadingSkeleton } from '@web/components/UI';
import { Icon, type IconName } from '@web/components/Icon';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { ClubSettingsSection } from '@web/components/ClubSettingsSection';
import { fetchVisaoGlobal } from '../services/api';

export default function VisaoPage() {
  const [dados, setDados] = useState<VisaoGlobal | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(() => {
    setErro('');
    fetchVisaoGlobal().then(setDados).catch(e => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  if (erro) return <div className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" onClick={carregar}>Tentar de novo</Btn></div>;
  if (!dados) return <LoadingSkeleton kind="cards"/>;
  const { totais, conexoes, clubes } = dados;
  const filtrados = clubes.filter(c => [c.nome, c.cidade, c.estado].filter(Boolean).join(' ').toLowerCase().includes(busca.trim().toLowerCase()));
  const cartoes: [string, number, IconName][] = [
    ['Clubes ativos', clubes.filter(c => c.ativo).length, 'shield'],
    ['Contas da plataforma', totais.usuarios, 'user'],
    ['Jogadores', totais.jogadores, 'team'],
    ['Partidas cadastradas', totais.partidas, 'ball'],
    ['Partidas ao vivo', totais.partidasAoVivo, 'live'],
    ['Conexões Web e App', conexoes.principal, 'desktop'],
  ];

  return (
    <div className="desktop-overview">
      <div className="page-header">
        <div><span className="ticket-kicker">Plataforma Ludora</span><h1 className="page-title">Visão global</h1><p className="page-sub">Clubes, elenco e atividade em um só lugar.</p></div>
        <Btn variant="ghost" onClick={carregar}><Icon name="refresh" size={17}/>Atualizar</Btn>
      </div>

      <dl className="desktop-overview-metrics">
        {cartoes.map(([rotulo, valor, icone]) => <div key={rotulo}>
          <dt><Icon name={icone} size={18}/>{rotulo}</dt><dd>{valor.toLocaleString('pt-BR')}</dd>
        </div>)}
      </dl>
      <ClubSettingsSection icon="shield" title="Clubes na plataforma" description={`${clubes.length} cadastros · ${clubes.filter(c => !c.ativo).length} indisponíveis`}>
        <CollectionSearch label="Buscar clube na visão global" placeholder="Nome, cidade ou UF…" value={busca} onChange={setBusca}/>
        {filtrados.length ? <div className="club-directory desktop-overview-clubs">{filtrados.map(c => <Link key={c.id} to={`/clubes/${c.id}`} className="club-directory-card">
          <ClubBadge src={c.escudo} name={c.nome} size={40}/><span className="ticket-card-copy"><strong>{c.nome}</strong><small>{[c.cidade, c.estado].filter(Boolean).join(' · ') || 'Localização pendente'} · {c.ativo ? c.plano : 'Indisponível'}</small></span><Icon name="chevronRight" size={17}/>
          <dl className="club-directory-meta"><div><dt>Membros</dt><dd>{c.membros}</dd></div><div><dt>SUBs</dt><dd>{c.categorias}</dd></div><div><dt>Jogadores</dt><dd>{c.jogadores}</dd></div><div><dt>Partidas</dt><dd>{c.partidas}</dd></div></dl>
        </Link>)}</div> : <div className="schedule-empty"><span><Icon name="search" size={23}/></span><div><h2>Nenhum clube encontrado</h2><p>{busca ? 'Experimente outro nome ou município.' : 'Os clubes cadastrados aparecerão aqui.'}</p></div></div>}
      </ClubSettingsSection>
    </div>
  );
}
