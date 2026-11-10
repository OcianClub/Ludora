import { ClubSubChoices, ClubeResumoCadastro, ENDERECO_VAZIO, EnderecoFields, enderecoCompleto, EscudoField, mascaraCnpj, SUBS } from '../components/ClubeCadastroFields';
import { requestJson } from '../services/api';
import { ClubeAtividade, ClubeConvites } from '../components/ClubeOperacoes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { MembroClube, MembrosDoClube, PapelClube, PlanoClube, VisaoGlobal } from '@ludora/shared-types';
import { Btn, DesktopState, Input, LoadingSkeleton, Modal } from '../components/AdminUI';
import { Toast } from '@web/components/Toast';
import { atualizarClube, definirPapel, fetchMembros, removerVinculo } from '../services/api';
import { PLANOS } from './Clubes';
import { ClubBadge } from '@web/components/Brand';
import { AdminIcon } from '../components/AdminIcon';
import { MotivoTiles } from '../components/MotivoTiles';
import { ClubeElenco } from '../components/ClubeElenco';
import { ClubSettingsSection } from '@web/components/ClubSettingsSection';
import { CategoryFilter } from '@web/components/CategoryFilter';
import { Icon } from '@web/components/Icon';
import { ExcluirIcone } from '../components/ExcluirIcone';
import { CargoClube, CargoIcon, PAPEIS_CLUBE } from '../components/CargoClube';
import { AddClubPerson } from '../components/AddClubPerson';
import { DesktopTabs } from '../components/DesktopTabs';
import { DesktopSelect } from '../components/DesktopSelect';
import { DesktopTable } from '../components/DesktopTable';
import { DesktopToggle } from '../components/DesktopToggle';
import { AccountIdentity } from '../components/AccountIdentity';
import './Clubes.css';
const ESCRITA: PapelClube[] = ['TECNICO', 'MESARIO'];

interface Edicao { usuarioId: number; nome: string; email: string; papel: PapelClube; todas: boolean; cats: number[]; novo?: boolean }

export default function ClubeDetalhePage() {
  return <ClubeDetalheContent key={useParams().id}/>;
}
function ClubeDetalheContent() {
  const clubeId = Number(useParams().id);
  const navigate = useNavigate();
  const location = useLocation();
  const retorno = location.state?.voltarClubes;
  const voltarClubes = typeof retorno === 'string' && /^\/clubes(?:\?|$)/.test(retorno) ? retorno : '/clubes';
  const contexto = useRef(clubeId);
  contexto.current = clubeId;
  const [clube, setClube] = useState<VisaoGlobal['clubes'][number] | null>(null);
  const [dados, setDados] = useState<MembrosDoClube | null>(null);
  const [erro, setErro] = useState('');
  const [atualizando, setAtualizando] = useState(true);
  const [aviso, setAviso] = useState('');
  const [dadosClube, setDadosClube] = useState({ nome: '', cnpj: '', endereco: ENDERECO_VAZIO, plano: 'TRIAL', escudo: null as string | null });
  const [editandoClube, setEditandoClube] = useState(false);
  const [salvandoClube, setSalvandoClube] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvandoPapel, setSalvandoPapel] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [confirmouCategoria, setConfirmouCategoria] = useState(false);
  const [erroPapel, setErroPapel] = useState('');
  const busyPapel = useRef(false);
  const vivo = useRef(true);
  const sequenciaCarga = useRef(0);
  useEffect(()=>{vivo.current = true;return ()=>{vivo.current = false;};},[]);
  const [aba, setAba] = useState<'visao' | 'acessos' | 'estrutura' | 'convites' | 'atividade'>('visao');
  const [remocao, setRemocao] = useState<MembroClube | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [subNovo, setSubNovo] = useState('');
  const [subAcao, setSubAcao] = useState<{ id: number; nome: string; acao: 'excluir' | 'desativar' | 'reativar' } | null>(null);
  useEffect(()=>setConfirmouCategoria(false),[subAcao]);
  const [estadoAberto, setEstadoAberto] = useState(false);
  const [motivoEstado, setMotivoEstado] = useState('');
  const [motivoLivre, setMotivoLivre] = useState(false);
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [confirmouExclusao, setConfirmouExclusao] = useState(false);
  const [subAtivo, setSubAtivo] = useState('');
  const [fase, setFase] = useState('');
  const [operando, setOperando] = useState(false);
  const operacaoPendente = useRef(false);
  const edicaoPendente = useRef(false);
  const remocaoPendente = useRef(false);
  const [erroOperacao, setErroOperacao] = useState('');

  const carregar = useCallback(async () => {
    const sequencia = ++sequenciaCarga.current;
    setErro('');setAtualizando(true);
    try {
      const [c, membros] = await Promise.all([requestJson<VisaoGlobal['clubes'][number]>(`/admin/clubes/${clubeId}/resumo`), fetchMembros(clubeId)]);
      if (!vivo.current || contexto.current !== clubeId || sequencia !== sequenciaCarga.current) return;
      setClube(c);
      setDados(membros);
      if (!c) setErro('O clube não está mais disponível nesta consulta.');
    } catch (e) { if (vivo.current && sequencia === sequenciaCarga.current) setErro((e as Error).message); }
    finally {if(vivo.current && sequencia === sequenciaCarga.current)setAtualizando(false);}
  }, [clubeId]);
  useEffect(() => { setClube(null); setDados(null); setEdicao(null); setErro(''); void carregar(); }, [carregar]);

  const falha = (e: unknown) => { if(vivo.current){setAviso(''); setErro((e as Error).message);} };
  const ok = (msg: string) => { if(vivo.current){setErro(''); setAviso(msg); void carregar();} };

  async function salvarClube(e: React.FormEvent) {
    e.preventDefault();
    if (!editandoClube || edicaoPendente.current) return;
    edicaoPendente.current=true;setSalvandoClube(true);
    try {
      const atual = { ...ENDERECO_VAZIO, cidade: clube?.cidade || '', estado: clube?.estado || '', ...clube?.endereco };
      const alterouEndereco = (Object.keys(ENDERECO_VAZIO) as (keyof typeof ENDERECO_VAZIO)[]).some(k => dadosClube.endereco[k] !== atual[k]);
      if (alterouEndereco && !enderecoCompleto(dadosClube.endereco)) throw new Error('Complete os campos obrigatórios do endereço da sede.');
      const atualizado = await atualizarClube(clubeId, {
        nome: dadosClube.nome,
        ...(dadosClube.cnpj ? { cnpj: dadosClube.cnpj } : {}),
        ...(alterouEndereco ? { endereco: dadosClube.endereco } : {}),
        plano: dadosClube.plano as PlanoClube,
        ...(dadosClube.escudo !== clube?.escudo ? { escudo_arquivo: dadosClube.escudo } : {}),
      });
      if (!vivo.current) return;
      setClube(anterior => anterior ? { ...anterior, ...atualizado } : anterior);
      setEditandoClube(false);
      ok('Clube atualizado.');
    } catch (err) { falha(err); }
    finally { edicaoPendente.current=false;if(vivo.current)setSalvandoClube(false); }
  }

  function abrirEdicao(m: MembroClube) {
    setErroPapel('');
    setEdicao({ usuarioId: m.usuario.id, nome: m.usuario.nome, email: m.usuario.email, papel: m.papel, todas: m.acesso_todas_categorias, cats: m.categorias.map(c => c.categoria_id) });
  }

  async function salvarPapel(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao || busyPapel.current) return;
    busyPapel.current = true; setErroPapel('');
    setSalvandoPapel(true);
    try {
      const entrada = { papel: edicao.papel, acesso_todas_categorias: edicao.todas, categoria_ids: edicao.cats };
      if (edicao.novo) await requestJson(`/admin/clubes/${clubeId}/membros/${edicao.usuarioId}`, {method:'POST',body:entrada});
      else await definirPapel(clubeId, edicao.usuarioId, entrada);
      if (!vivo.current) return;
      setEdicao(null);
      ok('Permissão atualizada.');
    } catch (err) { if (vivo.current) {setErroPapel((err as Error).message);void carregar();} }
    finally { busyPapel.current = false; if (vivo.current) setSalvandoPapel(false); }
  }

  async function remover() {
    if (!remocao || remocaoPendente.current) return;
    remocaoPendente.current=true;setRemovendo(true);
    try {
      await removerVinculo(clubeId, remocao.usuario.id);
      if(!vivo.current)return;
      ok('Vínculo removido.');
    } catch (err) {
      falha(err);
    } finally {
      remocaoPendente.current=false;
      if(vivo.current){setRemovendo(false);setRemocao(null);}
    }
  }

  async function executarOperacao(acao: 'categoria' | 'estado' | 'adicionar' | 'excluir') {
    if (operacaoPendente.current || acao === 'categoria' && subAcao?.acao !== 'reativar' && !confirmouCategoria) return;
    operacaoPendente.current=true;setOperando(true); setErroOperacao('');
    const base = `/admin/clubes/${clubeId}`;
    try {
      if (acao === 'excluir') {
        await requestJson(base, { method: 'DELETE' });
        if(!vivo.current)return;
        navigate('/clubes', { replace: true });
        return;
      }
      if (acao === 'estado' && clube) {
        await requestJson(`${base}/estado`, { method: 'PATCH', body: { ativo: !clube.ativo, motivo: motivoEstado } });
        if(!vivo.current)return;
        setEstadoAberto(false);
      } else if (acao === 'adicionar') {
        await requestJson(`${base}/categorias`, { method: 'POST', body: { idade: Number(subNovo) } }); if(!vivo.current)return; setSubNovo('');
      } else if (subAcao) {
        await requestJson(`${base}/categorias/${subAcao.id}`, subAcao.acao === 'excluir' ? { method: 'DELETE' } : { method: 'PATCH', body: { ativa: subAcao.acao === 'reativar' } });
        if(!vivo.current)return;
        setSubAcao(null);
      }
      ok('Alteração registrada.');
    } catch (e) { if(vivo.current)setErroOperacao((e as Error).message); }
    finally { operacaoPendente.current=false;if(vivo.current)setOperando(false); }
  }

  if (!dados || !clube) return erro ? <DesktopState error title="Não foi possível carregar o clube" description={erro} onRetry={() => void carregar()}/> : <LoadingSkeleton kind="form" label="Carregando dados do clube"/>;
  const exigeCategorias = edicao && ESCRITA.includes(edicao.papel) && !edicao.todas;
  const administradores = dados.membros.filter(membro => membro.papel === 'ADMIN');
  const categorias = dados.categorias;
  const categoriaDaFase = (tipo: string) => categorias.filter(c => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))[0];
  const faseAtiva = fase || (categoriaDaFase('INICIACAO') || !categoriaDaFase('BASE') ? 'INICIACAO' : 'BASE');
  const subSelecionado = categorias.find(c => String(c.id) === subAtivo && c.tipo === faseAtiva) || categoriaDaFase(faseAtiva);
  const endereco = { ...ENDERECO_VAZIO, cidade: clube.cidade || '', estado: clube.estado || '', ...clube.endereco };
  const plano = PLANOS.find(p => p.value === clube.plano)?.label || clube.plano;
  function abrirDados() {
    if (!clube) return;
    setDadosClube({ nome: clube.nome, cnpj: mascaraCnpj(clube.cnpj || ''), endereco, plano: clube.plano, escudo: clube.escudo });
    setErro(''); setEditandoClube(true);
  }

  return (
    <div className="desktop-club-page">
      <Link to={voltarClubes} className="btn btn-ghost btn-sm club-back"><Icon name="arrow" size={16}/>Voltar para clubes</Link>
      <div className="page-header">
        <div className="admin-club-heading">
          <ClubBadge src={clube.escudo} name={clube.nome} size={56} />
          <div><h1 className="page-title">{clube.nome}</h1><p className="page-sub">{[clube.cidade, clube.estado].filter(Boolean).join(' · ') || 'Localização não informada'}</p></div>
        </div>
        <div className="actions club-heading-actions"><span className="plano-tag club-plan-tag">{clube.ativo ? clube.plano : 'Indisponível'}</span>
          {aba === 'visao' && !editandoClube && <Btn type="button" variant="ghost" size="sm" onClick={abrirDados}><Icon name="edit" size={16}/>Editar clube</Btn>}
          {aba === 'visao' && editandoClube && !clube.membros && !clube.jogadores && !clube.competicoes && !clube.partidas &&
            <ExcluirIcone label="Excluir clube" onClick={() => { setConfirmouExclusao(false); setErroOperacao(''); setExcluirAberto(true); }}/>}
        </div>
      </div>
      <DesktopTabs label="Ficha administrativa do clube" value={aba} onChange={setAba} options={[
        {value:'visao',label:'Visão geral'}, {value:'acessos',label:'Acessos',count:dados.membros.length},
        {value:'estrutura',label:'Estrutura'}, {value:'convites',label:'Convites'}, {value:'atividade',label:'Atividade'},
      ]}>
      {erro && <div className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" disabled={atualizando} onClick={()=>void carregar()}>Tentar novamente</Btn></div>}
      {atualizando && <p className="dica" role="status">Atualizando dados do clube…</p>}
      <Toast message={aviso} onClose={() => setAviso('')}/>

      {aba === 'visao' && <div className="desktop-club-settings">
      <ClubSettingsSection icon="team" title="Resumo do clube" description="Contas, elenco e atividade esportiva.">
        <dl className="admin-club-metrics">
          <div><dt>Pessoas vinculadas</dt><dd>{clube.membros}</dd></div>
          <div><dt>Jogadores</dt><dd>{clube.jogadores}</dd></div>
          <div><dt>Partidas organizadas</dt><dd>{clube.partidas}</dd></div>
          <div><dt>Competições</dt><dd>{clube.competicoes}</dd></div>
        </dl>
      </ClubSettingsSection>
      {!editandoClube ? <ClubeResumoCadastro nome={clube.nome} escudo={clube.escudo} cnpj={clube.cnpj} endereco={endereco} plano={plano}/> :
        <form onSubmit={salvarClube} className="desktop-club-settings">
          <ClubSettingsSection icon="shield" title="Editar identidade do clube" description="Revise o cadastro antes de salvar.">
            <div className="form-grid">
              <Input label="Nome" value={dadosClube.nome} onChange={e => setDadosClube(f => ({ ...f, nome: e.target.value }))} required/>
              <DesktopSelect label="Plano" showLabel fullWidth options={PLANOS} value={dadosClube.plano} onChange={plano => setDadosClube(f => ({ ...f, plano }))}/>
              <Input className="full" label="CNPJ" inputMode="numeric" value={dadosClube.cnpj} onChange={e => setDadosClube(f => ({ ...f, cnpj: mascaraCnpj(e.target.value) }))}/>
              <EscudoField value={dadosClube.escudo} nome={dadosClube.nome} onChange={escudo => setDadosClube(f => ({ ...f, escudo }))}/>
            </div>
          </ClubSettingsSection>
          <EnderecoFields value={dadosClube.endereco} onChange={endereco => setDadosClube(f => ({ ...f, endereco }))}/>
          <div className="schedule-review-actions"><Btn type="button" variant="ghost" disabled={salvandoClube} onClick={() => { setEditandoClube(false); setErro(''); }}>Cancelar edição</Btn><Btn type="submit" disabled={salvandoClube}>{salvandoClube ? 'Salvando…' : 'Salvar dados'}</Btn></div>
        </form>}
      <ClubSettingsSection icon="settings" title="Operação e acesso" description="Disponibilidade, cadastro e administração do clube." className="club-operation-panel">
        <dl className="club-operation-data">
          <div><dt>Disponibilidade</dt><dd><span className="club-operation-status" data-active={clube.ativo}><AdminIcon name={clube.ativo ? 'check' : 'alert'} size={15}/>{clube.ativo ? 'Clube ativo' : 'Clube indisponível'}</span></dd><Btn size="sm" variant="ghost" onClick={() => { setMotivoEstado(''); setMotivoLivre(false); setErroOperacao(''); setEstadoAberto(true); }}>{clube.ativo ? 'Desativar clube' : 'Reativar clube'}</Btn></div>
          <div><dt>Cadastro</dt><dd>{!clube.cnpj || !enderecoCompleto(endereco) || !clube.escudo ? <>A completar <small>{[[!clube.cnpj,'CNPJ'],[!enderecoCompleto(endereco),'endereço'],[!clube.escudo,'escudo']].filter(([falta])=>falta).map(([,label])=>label).join(' · ')}</small></> : 'Dados preenchidos'}</dd>{!editandoClube && <Btn size="sm" variant="ghost" onClick={abrirDados}>Revisar cadastro</Btn>}</div>
          <div><dt>Estrutura</dt><dd>{dados.categorias.filter(c=>c.ativa).length} categorias ativas <small>{dados.categorias.length} cadastradas</small></dd><Btn size="sm" variant="ghost" onClick={()=>setAba('estrutura')}>Ver estrutura</Btn></div>
        </dl>
        <div className="club-operation-responsibles"><div className="bloco-topo"><h3>Administradores responsáveis</h3><Btn size="sm" variant="ghost" onClick={()=>setAba('acessos')}>Gerenciar acessos</Btn></div>
          {administradores.length ? <div className="club-responsibles-list">{administradores.map(m=><AccountIdentity key={m.usuario.id} nome={m.usuario.nome} email={m.usuario.email} actions={<CargoClube papel={m.papel}/>}/>)}</div> : <div className="bloco-topo"><p className="dica">Nenhum administrador definido.</p><Btn size="sm" onClick={()=>setAba('convites')}>Convidar administrador</Btn></div>}
        </div>
      </ClubSettingsSection>
      </div>}

      <Modal open={estadoAberto} title={clube.ativo ? 'Desativar clube?' : 'Reativar clube?'} onClose={() => { if (!operando) setEstadoAberto(false); }}>
        <p>{clube.ativo ? 'A entrada no clube fica indisponível e o histórico é preservado.' : 'Os membros recuperam as ações autorizadas por seu cargo. Pausas de manutenção continuam valendo.'}</p>
        <MotivoTiles label="Motivo da alteração" options={clube.ativo ? ['Pausa solicitada pelo clube', 'Cadastro em conferência', 'Encerramento do atendimento'] : ['Cadastro conferido', 'Retomada solicitada pelo clube']} value={motivoEstado} onChange={setMotivoEstado} custom={motivoLivre} setCustom={setMotivoLivre}/>
        {erroOperacao && <p role="alert" className="notice-error">{erroOperacao}</p>}
        <div className="schedule-review-actions"><Btn variant="ghost" disabled={operando} onClick={() => setEstadoAberto(false)}>Cancelar</Btn><Btn className={clube.ativo ? 'btn-danger-solid' : undefined} disabled={operando || motivoEstado.trim().length < 10} onClick={() => void executarOperacao('estado')}>{operando ? 'Registrando…' : 'Confirmar alteração'}</Btn></div>
      </Modal>
      <Modal open={excluirAberto} title="Excluir cadastro do clube?" onClose={() => { if (!operando) setExcluirAberto(false); }}>
        <p>O cadastro de <strong>{clube.nome}</strong> será removido. Times adversários reaproveitados e seus jogos permanecem cadastrados.</p>
        <label className="check"><input type="checkbox" checked={confirmouExclusao} onChange={e => setConfirmouExclusao(e.target.checked)}/> Confirmo a exclusão do cadastro.</label>
        {erroOperacao && <p role="alert" className="notice-error">{erroOperacao}</p>}
        <div className="schedule-review-actions"><Btn variant="ghost" disabled={operando} onClick={() => setExcluirAberto(false)}>Cancelar</Btn><Btn className="btn-danger-solid" disabled={operando || !confirmouExclusao} onClick={() => void executarOperacao('excluir')}>{operando ? 'Excluindo…' : 'Excluir clube'}</Btn></div>
      </Modal>
      <Modal open={!!subAcao} title={`${subAcao?.acao === 'excluir' ? 'Remover' : subAcao?.acao === 'desativar' ? 'Desativar' : 'Reativar'} ${subAcao?.nome.toUpperCase() || ''}?`} onClose={() => { if (!operando) setSubAcao(null); }}>
        <p>{subAcao?.acao === 'excluir' ? <>Remove permanentemente <strong>{subAcao.nome.toUpperCase()}</strong> de {clube.nome}. Só é permitido se não houver jogadores, partidas, inscrições ou outros vínculos. Havendo histórico, desative a categoria.</> : subAcao?.acao === 'desativar' ? <>Desativa <strong>{subAcao.nome.toUpperCase()}</strong> de {clube.nome}. O histórico é preservado; novos jogadores, times e confrontos neste SUB ficam bloqueados.</> : 'Volta a permitir novos cadastros neste SUB.'}</p>
        {subAcao?.acao !== 'reativar' && <label className="check club-confirmation"><input type="checkbox" checked={confirmouCategoria} onChange={e=>setConfirmouCategoria(e.target.checked)} disabled={operando}/>Entendo as consequências de {subAcao?.acao === 'excluir' ? 'remover' : 'desativar'} esta categoria.</label>}
        {erroOperacao && <p role="alert" className="notice-error">{erroOperacao}</p>}
        <div className="schedule-review-actions"><Btn variant="ghost" disabled={operando} onClick={() => setSubAcao(null)}>Cancelar</Btn>
          {subAcao?.acao === 'excluir' && erroOperacao && <Btn variant="ghost" disabled={operando} onClick={() => { setErroOperacao(''); setSubAcao({ ...subAcao, acao: 'desativar' }); }}>Desativar em vez de remover</Btn>}
          <Btn variant={subAcao?.acao === 'excluir' ? 'danger' : 'primary'} disabled={operando || subAcao?.acao !== 'reativar' && !confirmouCategoria} onClick={() => void executarOperacao('categoria')}>{operando ? 'Registrando…' : 'Confirmar'}</Btn></div>
      </Modal>

      {aba === 'convites' && <ClubeConvites key={clube.id} clubeId={clube.id} ativo={clube.ativo}/>}
      {aba === 'atividade' && <ClubeAtividade key={clube.id} clubeId={clube.id} />}

      {aba === 'estrutura' && <div className="desktop-club-structure">
        <div className="club-structure-controls">
        <CategoryFilter categories={categorias} phase={faseAtiva} selected={subSelecionado} label="Categorias do clube"
          onPhase={tipo => { setFase(tipo); setSubAtivo(String(categoriaDaFase(tipo)?.id ?? '')); }} onSelect={nome => setSubAtivo(String(categorias.find(c => c.tipo === faseAtiva && c.nome === nome)?.id ?? ''))}/>
        {subSelecionado && <div className="club-category-actions"><span>{subSelecionado.nome.toUpperCase()}{!subSelecionado.ativa && ' · Inativa'}</span><div className="actions">
          <Btn size="sm" variant="ghost" onClick={() => { setErroOperacao(''); setSubAcao({ id: subSelecionado.id, nome: subSelecionado.nome, acao: subSelecionado.ativa ? 'desativar' : 'reativar' }); }}>{subSelecionado.ativa ? 'Desativar categoria' : 'Reativar categoria'}</Btn>
          <Btn size="sm" variant="ghost" onClick={() => { setErroOperacao(''); setSubAcao({ id: subSelecionado.id, nome: subSelecionado.nome, acao: 'excluir' }); }}>Remover categoria</Btn>
        </div></div>}
        </div>
        {subSelecionado && <div className="club-roster"><ClubeElenco key={`${clubeId}:${subSelecionado.id}`} clubeId={clubeId} clubeNome={clube.nome} categoriaId={subSelecionado.id} categoriaNome={subSelecionado.nome} onAlterado={ok}
          onCategoria={id => { const proximo = categorias.find(c => c.id === id); if (proximo) { setFase(proximo.tipo); setSubAtivo(String(id)); } }}/></div>}
        {!dados.categorias.length && <p className="dica">Este clube ainda não tem categorias.</p>}
        <div className="club-cep"><DesktopSelect label="Adicionar SUB" value={subNovo} options={[{value:'',label:'Escolher categoria'},...SUBS.filter(s => !dados.categorias.some(c => c.faixaIdade === s)).map(s => ({ value: String(s), label: `SUB-${s}` }))]} onChange={setSubNovo}/>
        <Btn size="sm" disabled={!subNovo || operando} onClick={() => void executarOperacao('adicionar')}>Adicionar categoria</Btn></div>
        {!subAcao && erroOperacao && <p className="notice-error" role="alert">{erroOperacao}</p>}
      </div>}

      {aba === 'acessos' && <section className="club-access-section">
        <div className="bloco-topo">
          <h2 className="section-title">Pessoas e permissões</h2>
          <Btn size="sm" onClick={() => setAdicionando(true)}>Adicionar pessoa</Btn>
        </div>
        {dados.membros.length === 0 ? <DesktopState plain icon="people" title="Nenhuma pessoa vinculada" description="Adicione uma pessoa ou envie um convite para este clube."/> : (
          <DesktopTable label="Pessoas e permissões" tableClassName="club-access-table">
              <thead><tr><th scope="col">Pessoa</th><th scope="col">Cargo</th><th scope="col">Categorias</th><th scope="col"><span className="sr-only">Gerenciar acesso</span></th></tr></thead>
              <tbody>
                {dados.membros.map(m => (
                  <tr key={m.usuario.id}>
                    <td><AccountIdentity nome={m.usuario.nome} email={m.usuario.email}/></td>
                    <td><CargoClube papel={m.papel}/></td>
                    <td>{m.papel === 'ADMIN' || m.acesso_todas_categorias ? 'Todas as categorias' : ESCRITA.includes(m.papel) ? <span className="club-access-categories">{m.categorias.map(c=><span key={c.categoria_id}>{categorias.find(v=>v.id === c.categoria_id)?.nome.toUpperCase() || 'Categoria indisponível'}</span>)}</span> : 'Conteúdo público'}</td>
                    <td><div className="actions"><Btn size="sm" variant="ghost" onClick={() => abrirEdicao(m)}>Alterar</Btn><Btn size="sm" variant="danger" className="btn-danger-solid" onClick={() => setRemocao(m)}>Remover</Btn></div></td>
                  </tr>
                ))}
              </tbody>
          </DesktopTable>
        )}
      </section>}

      <Modal open={!!remocao} onClose={() => { if (!removendo) setRemocao(null); }} title="Remover acesso ao clube?">
        <p><strong>{remocao?.usuario.nome}</strong> perderá o vínculo e as permissões de <strong>{clube.nome}</strong>.</p>
        <div className="admin-club-actions">
          <Btn variant="ghost" disabled={removendo} onClick={() => setRemocao(null)}>Cancelar</Btn>
          <Btn variant="danger" className="btn-danger-solid" disabled={removendo} onClick={() => void remover()}>{removendo ? 'Removendo…' : 'Remover acesso'}</Btn>
        </div>
      </Modal>

      <Modal className="club-access-dialog" open={!!edicao} onClose={() => { if (!salvandoPapel) setEdicao(null); }} title={edicao ? `Permissão · ${edicao.nome}` : ''}>
        {edicao && (
          <form onSubmit={salvarPapel} className="form-grid">
            <div className="full"><AccountIdentity nome={edicao.nome} email={edicao.email}/></div>
            {erroPapel && <p className="notice-error full" role="alert">{erroPapel}</p>}
            <div className="full"><DesktopSelect label="Cargo no clube" fullWidth showLabel expandInDialog options={PAPEIS_CLUBE.map(p=>({...p,icon:<CargoIcon papel={p.value}/>}))} value={edicao.papel} onChange={papel=>setEdicao({...edicao,papel})} disabled={salvandoPapel}/></div>
            {ESCRITA.includes(edicao.papel) && (
              <div className="full paulista-follow"><strong>Acesso a todas as categorias</strong><DesktopToggle label="Acesso a todas as categorias" checked={edicao.todas} disabled={salvandoPapel} onChange={todas=>setEdicao({...edicao,todas})}/></div>
            )}
            {exigeCategorias && (
              <div className="full"><h3 className="club-settings-hint">Categorias permitidas</h3>
                <ClubSubChoices options={dados.categorias} selected={edicao.cats} onChange={id => setEdicao({ ...edicao, cats: edicao.cats.includes(id) ? edicao.cats.filter(x => x !== id) : [...edicao.cats, id] })}/>
              </div>
            )}
            <div className="full" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn type="button" variant="ghost" disabled={salvandoPapel} onClick={() => setEdicao(null)}>Cancelar</Btn><Btn type="submit" disabled={salvandoPapel || !!(exigeCategorias && !edicao.cats.length)}>{salvandoPapel ? 'Salvando…' : 'Salvar'}</Btn>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={adicionando} onClose={() => setAdicionando(false)} title="Adicionar pessoa ao clube">
        {adicionando && <AddClubPerson clubeId={clubeId} onSelect={u=>{setAdicionando(false);setErroPapel('');setEdicao({usuarioId:u.id,nome:u.nome,email:u.email,papel:'TORCEDOR',todas:false,cats:[],novo:true});}}/>}
      </Modal>
      </DesktopTabs>
    </div>
  );
}
