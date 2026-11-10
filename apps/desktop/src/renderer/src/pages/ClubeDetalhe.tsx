import { ClubSubChoices, ClubeResumoCadastro, ENDERECO_VAZIO, EnderecoFields, enderecoCompleto, EscudoField, mascaraCnpj, SUBS } from '../components/ClubeCadastroFields';
import { FilterSelect } from '@web/components/FilterSelect';
import { requestJson } from '../services/api';
import { ClubeAtividade, ClubeConvites } from '../components/ClubeOperacoes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { MembroClube, MembrosDoClube, PapelClube, PlanoClube, UsuarioGlobal, VisaoGlobal } from '@ludora/shared-types';
import { Btn, Card, DesktopState, Empty, Input, LoadingSkeleton, Modal } from '../components/AdminUI';
import { Toast } from '@web/components/Toast';
import { atualizarClube, definirPapel, fetchMembros, fetchUsuarios, fetchVisaoGlobal, removerVinculo } from '../services/api';
import { PLANOS } from './Clubes';
import { ClubBadge } from '@web/components/Brand';
import { AdminIcon } from '../components/AdminIcon';
import { OptionTiles } from '../components/OptionTiles';
import { MotivoTiles } from '../components/MotivoTiles';
import { ClubeElenco } from '../components/ClubeElenco';
import { ClubSettingsSection } from '@web/components/ClubSettingsSection';
import { CategoryFilter } from '@web/components/CategoryFilter';
import { Icon } from '@web/components/Icon';
import { ExcluirIcone } from '../components/ExcluirIcone';
import { CargoClube, PAPEIS_CLUBE } from '../components/CargoClube';
import { CollectionSearch } from '@web/components/CollectionToolbar';
const ESCRITA: PapelClube[] = ['TECNICO', 'MESARIO'];

interface Edicao { usuarioId: number; nome: string; papel: PapelClube; todas: boolean; cats: number[] }

export default function ClubeDetalhePage() {
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
  const [aviso, setAviso] = useState('');
  const [dadosClube, setDadosClube] = useState({ nome: '', cnpj: '', endereco: ENDERECO_VAZIO, plano: 'TRIAL', escudo: null as string | null });
  const [editandoClube, setEditandoClube] = useState(false);
  const [salvandoClube, setSalvandoClube] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvandoPapel, setSalvandoPapel] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<UsuarioGlobal[]>([]);
  const [aba, setAba] = useState<'visao' | 'acessos' | 'estrutura' | 'convites' | 'atividade'>('visao');
  const [remocao, setRemocao] = useState<MembroClube | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [subNovo, setSubNovo] = useState('');
  const [subAcao, setSubAcao] = useState<{ id: number; nome: string; acao: 'excluir' | 'desativar' | 'reativar' } | null>(null);
  const [estadoAberto, setEstadoAberto] = useState(false);
  const [motivoEstado, setMotivoEstado] = useState('');
  const [motivoLivre, setMotivoLivre] = useState(false);
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [confirmouExclusao, setConfirmouExclusao] = useState(false);
  const [subAtivo, setSubAtivo] = useState('');
  const [fase, setFase] = useState('');
  const [operando, setOperando] = useState(false);
  const [erroOperacao, setErroOperacao] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [visao, membros] = await Promise.all([fetchVisaoGlobal(), fetchMembros(clubeId)]);
      if (contexto.current !== clubeId) return;
      const c = visao.clubes.find(x => x.id === clubeId) ?? null;
      setClube(c);
      setDados(membros);
      if (!c) setErro('O clube não está mais disponível nesta consulta.');
    } catch (e) { setErro((e as Error).message); }
  }, [clubeId]);
  useEffect(() => { setClube(null); setDados(null); setEdicao(null); setErro(''); void carregar(); }, [carregar]);

  const falha = (e: unknown) => { setAviso(''); setErro((e as Error).message); };
  const ok = (msg: string) => { setErro(''); setAviso(msg); void carregar(); };

  async function salvarClube(e: React.FormEvent) {
    e.preventDefault();
    if (!editandoClube || salvandoClube) return;
    setSalvandoClube(true);
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
      setClube(anterior => anterior ? { ...anterior, ...atualizado } : anterior);
      setEditandoClube(false);
      ok('Clube atualizado.');
    } catch (err) { falha(err); }
    finally { setSalvandoClube(false); }
  }

  function abrirEdicao(m: MembroClube) {
    setEdicao({ usuarioId: m.usuario.id, nome: m.usuario.nome, papel: m.papel, todas: m.acesso_todas_categorias, cats: m.categorias.map(c => c.categoria_id) });
  }

  async function salvarPapel(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao || salvandoPapel) return;
    setSalvandoPapel(true);
    try {
      await definirPapel(clubeId, edicao.usuarioId, { papel: edicao.papel, acesso_todas_categorias: edicao.todas, categoria_ids: edicao.cats });
      setEdicao(null);
      ok('Permissão atualizada.');
    } catch (err) { falha(err); }
    finally { setSalvandoPapel(false); }
  }

  async function remover() {
    if (!remocao || removendo) return;
    setRemovendo(true);
    try {
      await removerVinculo(clubeId, remocao.usuario.id);
      ok('Vínculo removido.');
    } catch (err) {
      falha(err);
    } finally {
      setRemovendo(false);
      setRemocao(null);
    }
  }

  async function procurar(e: React.FormEvent) {
    e.preventDefault();
    try { setAchados(await fetchUsuarios(busca)); } catch (err) { falha(err); }
  }

  async function executarOperacao(acao: 'categoria' | 'estado' | 'adicionar' | 'excluir') {
    if (operando) return;
    setOperando(true); setErroOperacao('');
    const base = `/admin/clubes/${clubeId}`;
    try {
      if (acao === 'excluir') {
        await requestJson(base, { method: 'DELETE' });
        navigate('/clubes', { replace: true });
        return;
      }
      if (acao === 'estado' && clube) {
        await requestJson(`${base}/estado`, { method: 'PATCH', body: { ativo: !clube.ativo, motivo: motivoEstado } });
        setEstadoAberto(false);
      } else if (acao === 'adicionar') {
        await requestJson(`${base}/categorias`, { method: 'POST', body: { idade: Number(subNovo) } }); setSubNovo('');
      } else if (subAcao) {
        await requestJson(`${base}/categorias/${subAcao.id}`, subAcao.acao === 'excluir' ? { method: 'DELETE' } : { method: 'PATCH', body: { ativa: subAcao.acao === 'reativar' } });
        setSubAcao(null);
      }
      ok('Alteração registrada.');
    } catch (e) { setErroOperacao((e as Error).message); }
    finally { setOperando(false); }
  }

  if (!dados || !clube) return erro ? <DesktopState error title="Não foi possível carregar o clube" description={erro} onRetry={() => void carregar()}/> : <LoadingSkeleton kind="form" label="Carregando dados do clube"/>;
  const idsMembros = new Set(dados.membros.map(m => m.usuario.id));
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
      <Link to={voltarClubes} className="voltar">← Clubes</Link>
      <div className="page-header">
        <div className="admin-club-heading">
          <ClubBadge src={clube.escudo} name={clube.nome} size={56} />
          <div><h1 className="page-title">{clube.nome}</h1><p className="page-sub">{[clube.cidade, clube.estado].filter(Boolean).join(' · ') || 'Localização não informada'}</p></div>
        </div>
        <div className="actions"><span className="plano-tag">{clube.ativo ? clube.plano : 'Indisponível'}</span>
          {aba === 'visao' && !editandoClube && <Btn type="button" variant="ghost" size="sm" onClick={abrirDados}><Icon name="edit" size={16}/>Editar clube</Btn>}
          {aba === 'visao' && editandoClube && !clube.membros && !clube.jogadores && !clube.competicoes && !clube.partidas &&
            <ExcluirIcone label="Excluir clube" onClick={() => { setConfirmouExclusao(false); setErroOperacao(''); setExcluirAberto(true); }}/>}
        </div>
      </div>
      <nav className="admin-club-tabs" aria-label="Ficha administrativa do clube">
        {([['visao', 'Visão geral'], ['acessos', 'Acessos'], ['estrutura', 'Estrutura'], ['convites', 'Convites'], ['atividade', 'Atividade']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-current={aba === id ? 'true' : undefined} onClick={() => setAba(id)}>{label}</button>
        )}
      </nav>
      {erro && <div className="notice-error" role="alert">{erro}</div>}
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
              <FilterSelect label="Plano" emptyLabel="A definir" options={PLANOS} value={dadosClube.plano} onChange={plano => setDadosClube(f => ({ ...f, plano }))}/>
              <Input className="full" label="CNPJ" inputMode="numeric" value={dadosClube.cnpj} onChange={e => setDadosClube(f => ({ ...f, cnpj: mascaraCnpj(e.target.value) }))}/>
              <EscudoField value={dadosClube.escudo} nome={dadosClube.nome} onChange={escudo => setDadosClube(f => ({ ...f, escudo }))}/>
            </div>
          </ClubSettingsSection>
          <EnderecoFields value={dadosClube.endereco} onChange={endereco => setDadosClube(f => ({ ...f, endereco }))}/>
          <div className="schedule-review-actions"><Btn type="button" variant="ghost" disabled={salvandoClube} onClick={() => { setEditandoClube(false); setErro(''); }}>Cancelar edição</Btn><Btn type="submit" disabled={salvandoClube}>{salvandoClube ? 'Salvando…' : 'Salvar dados'}</Btn></div>
        </form>}
      <ClubSettingsSection icon="settings" title="Operação e acesso" description="Situação do cadastro e responsáveis pelo clube." className="admin-club-onboarding">
        <ul>
          <li><AdminIcon name={clube.ativo ? 'check' : 'alert'} size={16} /><span>{clube.ativo ? 'Clube ativo' : 'Clube indisponível'}</span><Btn size="sm" variant="ghost" onClick={() => { setMotivoEstado(''); setMotivoLivre(false); setErroOperacao(''); setEstadoAberto(true); }}>{clube.ativo ? 'Desativar clube' : 'Reativar clube'}</Btn></li>
          {(!clube.cnpj || !clube.endereco?.numero || !clube.escudo) && <li><AdminIcon name="alert" size={16}/><span>Cadastro a completar · {[[!clube.cnpj, 'CNPJ'], [!clube.endereco?.numero, 'endereço'], [!clube.escudo, 'escudo']].filter(([falta]) => falta).map(([, label]) => label).join(', ')}</span></li>}
          <li><AdminIcon name={dados.categorias.length ? 'check' : 'alert'} size={16} /><span>{dados.categorias.length ? `${dados.categorias.length} categorias configuradas` : 'Categorias a configurar'}</span><Btn size="sm" variant="ghost" onClick={() => setAba('estrutura')}>Ver estrutura</Btn></li>
          <li><AdminIcon name={administradores.length ? 'check' : 'alert'} size={16} /><span>{administradores.length ? administradores.map(m => m.usuario.nome).join(', ') : 'Administrador a definir'}</span><Btn size="sm" variant="ghost" onClick={() => setAba('acessos')}>Ver acessos</Btn>{!administradores.length && <Btn size="sm" onClick={() => setAba('convites')}>Convidar administrador</Btn>}</li>
        </ul>
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
        <p>{subAcao?.acao === 'excluir' ? 'A API vai conferir vínculos antes de remover a categoria.' : subAcao?.acao === 'desativar' ? 'Preserva o histórico e impede o cadastro de novos jogadores, times e confrontos neste SUB.' : 'Volta a permitir novos cadastros neste SUB.'}</p>
        {erroOperacao && <p role="alert" className="notice-error">{erroOperacao}</p>}
        <div className="schedule-review-actions"><Btn variant="ghost" disabled={operando} onClick={() => setSubAcao(null)}>Cancelar</Btn>
          {subAcao?.acao === 'excluir' && erroOperacao && <Btn variant="ghost" disabled={operando} onClick={() => { setErroOperacao(''); setSubAcao({ ...subAcao, acao: 'desativar' }); }}>Desativar em vez de remover</Btn>}
          <Btn variant={subAcao?.acao === 'excluir' ? 'danger' : 'primary'} disabled={operando} onClick={() => void executarOperacao('categoria')}>{operando ? 'Registrando…' : 'Confirmar'}</Btn></div>
      </Modal>

      {aba === 'convites' && <ClubeConvites key={clube.id} clubeId={clube.id} />}
      {aba === 'atividade' && <ClubeAtividade key={clube.id} clubeId={clube.id} />}

      {aba === 'estrutura' && <div className="desktop-club-structure">
        <CategoryFilter categories={categorias} phase={faseAtiva} selected={subSelecionado} label="Categorias do clube"
          onPhase={tipo => { setFase(tipo); setSubAtivo(String(categoriaDaFase(tipo)?.id ?? '')); }} onSelect={nome => setSubAtivo(String(categorias.find(c => c.tipo === faseAtiva && c.nome === nome)?.id ?? ''))}/>
        {subSelecionado && <div className="club-roster"><div className="schedule-review-actions">
          <Btn size="sm" variant="ghost" onClick={() => { setErroOperacao(''); setSubAcao({ id: subSelecionado.id, nome: subSelecionado.nome, acao: subSelecionado.ativa ? 'desativar' : 'reativar' }); }}>{subSelecionado.ativa ? 'Desativar categoria' : 'Reativar categoria'}</Btn>
          <Btn size="sm" variant="ghost" onClick={() => { setErroOperacao(''); setSubAcao({ id: subSelecionado.id, nome: subSelecionado.nome, acao: 'excluir' }); }}>Remover categoria</Btn>
        </div><ClubeElenco key={`${clubeId}:${subSelecionado.id}`} clubeId={clubeId} clubeNome={clube.nome} categoriaId={subSelecionado.id} categoriaNome={subSelecionado.nome} onAlterado={ok}
          onCategoria={id => { const proximo = categorias.find(c => c.id === id); if (proximo) { setFase(proximo.tipo); setSubAtivo(String(id)); } }}/></div>}
        {!dados.categorias.length && <p className="dica">Este clube ainda não tem categorias.</p>}
        <div className="club-cep"><FilterSelect label="Adicionar SUB" emptyLabel="Escolher categoria" value={subNovo} options={SUBS.filter(s => !dados.categorias.some(c => c.faixaIdade === s)).map(s => ({ value: s, label: `SUB-${s}` }))} onChange={setSubNovo}/>
        <Btn size="sm" disabled={!subNovo || operando} onClick={() => void executarOperacao('adicionar')}>Adicionar categoria</Btn></div>
        {!subAcao && erroOperacao && <p className="notice-error" role="alert">{erroOperacao}</p>}
      </div>}

      {aba === 'acessos' && <Card>
        <div className="bloco-topo">
          <h2 className="section-title">Pessoas e permissões</h2>
          <Btn size="sm" onClick={() => { setAdicionando(true); setBusca(''); setAchados([]); }}>Adicionar pessoa</Btn>
        </div>
        {dados.membros.length === 0 ? <Empty icon="👥" message="Nenhuma pessoa vinculada" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Pessoa</th><th>Cargo</th><th>Categorias</th><th /></tr></thead>
              <tbody>
                {dados.membros.map(m => (
                  <tr key={m.usuario.id}>
                    <td><strong>{m.usuario.nome}</strong><br /><small className="text-sec">{m.usuario.email}</small></td>
                    <td><CargoClube papel={m.papel}/></td>
                    <td>{m.papel === 'ADMIN' || m.acesso_todas_categorias ? 'Todas' : ESCRITA.includes(m.papel) ? m.categorias.length : '—'}</td>
                    <td><div className="actions"><Btn size="sm" variant="ghost" onClick={() => abrirEdicao(m)}>Alterar</Btn><Btn size="sm" variant="danger" className="btn-danger-solid" onClick={() => setRemocao(m)}>Remover</Btn></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>}

      <Modal open={!!remocao} onClose={() => { if (!removendo) setRemocao(null); }} title="Remover acesso ao clube?">
        <p><strong>{remocao?.usuario.nome}</strong> perderá o vínculo e as permissões de <strong>{clube.nome}</strong>.</p>
        <div className="admin-club-actions">
          <Btn variant="ghost" disabled={removendo} onClick={() => setRemocao(null)}>Cancelar</Btn>
          <Btn variant="danger" className="btn-danger-solid" disabled={removendo} onClick={() => void remover()}>{removendo ? 'Removendo…' : 'Remover acesso'}</Btn>
        </div>
      </Modal>

      <Modal open={!!edicao} onClose={() => { if (!salvandoPapel) setEdicao(null); }} title={edicao ? `Permissão · ${edicao.nome}` : ''}>
        {edicao && (
          <form onSubmit={salvarPapel} className="form-grid">
            <div className="full"><OptionTiles label="Cargo" options={[...PAPEIS_CLUBE]} value={edicao.papel} onChange={papel => setEdicao({ ...edicao, papel: papel as PapelClube })}/></div>
            {ESCRITA.includes(edicao.papel) && (
              <div className="full paulista-follow"><strong>Acesso a todas as categorias</strong><button type="button" className="settings-switch" role="switch" aria-label="Acesso a todas as categorias" aria-checked={edicao.todas} onClick={() => setEdicao({ ...edicao, todas: !edicao.todas })}><span className="settings-switch-thumb" aria-hidden="true"/></button></div>
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
        <form onSubmit={procurar} className="form-grid">
          <CollectionSearch className="full" label="Buscar usuário (nome ou e-mail)" placeholder="Nome ou e-mail…" value={busca} onChange={setBusca}/>
          <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn type="submit" variant="ghost">Buscar</Btn></div>
        </form>
        <div className="achados">
          {achados.filter(u => !idsMembros.has(u.id)).map(u => (
            <div key={u.id} className="achado">
              <span><strong>{u.nome}</strong><small>{u.email}</small></span>
              <Btn size="sm" onClick={() => { setAdicionando(false); setEdicao({ usuarioId: u.id, nome: u.nome, papel: 'TORCEDOR', todas: false, cats: [] }); }}>Escolher</Btn>
            </div>
          ))}
          {achados.length > 0 && achados.every(u => idsMembros.has(u.id)) && <p className="dica">Todos os resultados já fazem parte do clube.</p>}
        </div>
      </Modal>
    </div>
  );
}
