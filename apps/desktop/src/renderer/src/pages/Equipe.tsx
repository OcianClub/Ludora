import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@web/components/Icon';
import { Btn, Card, LoadingSkeleton } from '@web/components/UI';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export const NOMES_PAPEIS = {
  SUPERADMIN: 'Administrador Ludora', SUPORTE: 'Suporte', DESENVOLVEDOR: 'Desenvolvedor',
};
type Diagnostico = {
  banco: string; latenciaMs: number; consultadoEm: string;
  emailConfigurado: boolean; paulistaHabilitado: boolean;
};
const chamados = { to: '/chamados', label: 'Abrir fila de chamados', detail: 'Consulte relatos e acompanhe as respostas.', icon: 'info' } as const;
const manutencao = { to: '/manutencao', label: 'Ver manutenções', detail: 'Consulte pausas e prazos de revisão.', icon: 'settings' } as const;
const atalhos: Record<keyof typeof NOMES_PAPEIS, { to: string; label: string; detail: string; icon: IconName }[]> = {
  SUPERADMIN: [chamados, { to: '/clubes', label: 'Gerenciar clubes', detail: 'Veja cadastros, categorias e acessos.', icon: 'shield' }, manutencao],
  SUPORTE: [{ ...chamados, to: '/chamados?visao=MEUS', label: 'Meus chamados', detail: 'Acompanhe os relatos que você abriu ou assumiu.' }, chamados, manutencao],
  DESENVOLVEDOR: [{ ...chamados, to: '/chamados?visao=ENCAMINHADOS', label: 'Ver encaminhados', detail: 'Investigue os chamados enviados pelo atendimento.' }, chamados],
};

export default function EquipePage() {
  const { usuario } = useAdminAuth();
  const [dados, setDados] = useState<Diagnostico | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  async function carregar() {
    setCarregando(true); setErro('');
    try {
      const resposta = await window.ludora.api.requisicao<Diagnostico & { error?: string }>('GET', '/admin/equipe/diagnostico');
      if (!resposta.ok) throw new Error(resposta.data.error || 'Não foi possível consultar os serviços.');
      setDados(resposta.data);
    } catch (error) { setErro((error as Error).message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, []);
  const acessos = usuario ? atalhos[usuario.papel_plataforma] : [];
  return <div className="equipe-page">
    <div className="page-header"><div><h1 className="page-title">Área da equipe</h1>
      <p className="page-sub">{usuario && `${usuario.nome} · ${NOMES_PAPEIS[usuario.papel_plataforma]}`}</p></div></div>
    <section className="ticket-day" aria-label="Acesso rápido"><h2>Acesso rápido</h2><div className="equipe-atalhos">
      {acessos.map(a => <Link to={a.to} key={a.to} className="ticket-card equipe-atalho"><span className="ticket-card-icon"><Icon name={a.icon} size={19}/></span><span className="ticket-card-copy"><strong>{a.label}</strong><small>{a.detail}</small></span><Icon name="chevronRight" size={16}/></Link>)}
    </div></section>
    <Card><div className="page-header equipe-diagnostico-heading"><div><h2 className="section-title">Diagnóstico dos serviços</h2>
      {dados && !erro && <p className="page-sub">Última consulta {new Date(dados.consultadoEm).toLocaleString('pt-BR')}</p>}</div>
      <Btn variant="ghost" disabled={carregando} onClick={() => void carregar()}><Icon name="refresh" size={16}/>Atualizar diagnóstico</Btn></div>
      {erro && <p className="notice-error" role="alert">{erro}</p>}
      {carregando ? <LoadingSkeleton kind="cards" count={3}/> : dados && !erro && <dl className="equipe-diagnostico">
        <div><dt>Banco de dados</dt><dd>Disponível · {dados.latenciaMs} ms</dd></div>
        <div><dt>Envio de e-mail</dt><dd>{dados.emailConfigurado ? 'Provedor configurado; entrega depende de cada envio' : 'Provedor não configurado'}</dd></div>
        <div><dt>Integração Paulista</dt><dd>{dados.paulistaHabilitado ? 'Habilitada' : 'Desabilitada neste ambiente'}</dd></div>
      </dl>}
    </Card>
  </div>;
}
