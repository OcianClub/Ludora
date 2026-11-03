import { ClubeAtividade, ClubeConvites } from '../components/ClubeOperacoes';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MembroClube, MembrosDoClube, PapelClube, PlanoClube, UsuarioGlobal, VisaoGlobal } from '@ludora/shared-types';
import { Btn, Card, Empty, Input, Modal, PapelBadge, Select, Spinner } from '@web/components/UI';
import { atualizarClube, criarCategoriasPadrao, definirPapel, fetchMembros, fetchUsuarios, fetchVisaoGlobal, removerVinculo } from '../services/api';
import { PLANOS } from './Clubes';
import { ClubBadge } from '@web/components/Brand';
import { AdminIcon } from '../components/AdminIcon';

const PAPEIS: { value: PapelClube; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'TECNICO', label: 'Técnico' },
  { value: 'MESARIO', label: 'Mesário' },
  { value: 'OLHEIRO', label: 'Olheiro' },
  { value: 'TORCEDOR', label: 'Visitante' },
];
const ESCRITA: PapelClube[] = ['TECNICO', 'MESARIO'];

interface Edicao { usuarioId: number; nome: string; papel: PapelClube; todas: boolean; cats: number[] }

export default function ClubeDetalhePage() {
  const clubeId = Number(useParams().id);
  const [clube, setClube] = useState<VisaoGlobal['clubes'][number] | null>(null);
  const [dados, setDados] = useState<MembrosDoClube | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [dadosClube, setDadosClube] = useState({ nome: '', cidade: '', estado: '', plano: 'TRIAL', escudo: '' });
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<UsuarioGlobal[]>([]);
  const [aba, setAba] = useState<'visao' | 'acessos' | 'estrutura' | 'convites' | 'atividade'>('visao');
  const [remocao, setRemocao] = useState<MembroClube | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [criandoCategorias, setCriandoCategorias] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [visao, membros] = await Promise.all([fetchVisaoGlobal(), fetchMembros(clubeId)]);
      const c = visao.clubes.find(x => x.id === clubeId) ?? null;
      setClube(c);
      setDados(membros);
      if (c) setDadosClube({ nome: c.nome, cidade: c.cidade ?? '', estado: c.estado ?? '', plano: c.plano, escudo: c.escudo ?? '' });
    } catch (e) { setErro((e as Error).message); }
  }, [clubeId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const falha = (e: unknown) => { setAviso(''); setErro((e as Error).message); };
  const ok = (msg: string) => { setErro(''); setAviso(msg); void carregar(); };

  async function salvarClube(e: React.FormEvent) {
    e.preventDefault();
    try {
      await atualizarClube(clubeId, {
        nome: dadosClube.nome, cidade: dadosClube.cidade || null, estado: dadosClube.estado || null,
        plano: dadosClube.plano as PlanoClube, escudo: dadosClube.escudo || null,
      });
      ok('Clube atualizado.');
    } catch (err) { falha(err); }
  }

  function abrirEdicao(m: MembroClube) {
    setEdicao({ usuarioId: m.usuario.id, nome: m.usuario.nome, papel: m.papel, todas: m.acesso_todas_categorias, cats: m.categorias.map(c => c.categoria_id) });
  }

  async function salvarPapel(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    try {
      await definirPapel(clubeId, edicao.usuarioId, { papel: edicao.papel, acesso_todas_categorias: edicao.todas, categoria_ids: edicao.cats });
      setEdicao(null);
      ok('Permissão atualizada.');
    } catch (err) { falha(err); }
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

  async function adicionarCategorias() {
    setCriandoCategorias(true);
    try {
      const { adicionadas } = await criarCategoriasPadrao(clubeId);
      ok(adicionadas ? 'Categorias padrão adicionadas.' : 'As categorias padrão já estão configuradas.');
    } catch (err) {
      falha(err);
    } finally {
      setCriandoCategorias(false);
    }
  }

  if (!dados || !clube) return erro ? <div className="notice-error" role="alert">{erro}</div> : <Spinner />;
  const idsMembros = new Set(dados.membros.map(m => m.usuario.id));
  const exigeCategorias = edicao && ESCRITA.includes(edicao.papel) && !edicao.todas;
  const administradores = dados.membros.filter(membro => membro.papel === 'ADMIN');

  return (
    <div>
      <Link to="/clubes" className="voltar">← Clubes</Link>
      <div className="page-header">
        <div className="admin-club-heading">
          <ClubBadge src={clube.escudo} size={56} />
          <div><h1 className="page-title">{clube.nome}</h1><p className="page-sub">{[clube.cidade, clube.estado].filter(Boolean).join(' · ') || 'Localização não informada'}</p></div>
        </div>
        <span className="plano-tag">{clube.plano}</span>
      </div>
      <nav className="admin-club-tabs" aria-label="Ficha administrativa do clube">
        {([['visao', 'Visão geral'], ['acessos', 'Acessos'], ['estrutura', 'Estrutura'], ['convites', 'Convites'], ['atividade', 'Atividade']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-current={aba === id ? 'true' : undefined} onClick={() => setAba(id)}>{label}</button>
        )}
      </nav>
      {erro && <div className="notice-error" role="alert">{erro}</div>}
      {aviso && <div className="notice-ok" role="status">{aviso}</div>}

      {aba === 'visao' && <>
      <Card className="admin-club-onboarding">
        <h2 className="section-title">Configuração inicial</h2>
        <ul>
          <li><AdminIcon name="check" size={16} /><span>Clube cadastrado</span></li>
          <li><AdminIcon name={dados.categorias.length ? 'check' : 'alert'} size={16} /><span>{dados.categorias.length ? `${dados.categorias.length} categorias configuradas` : 'Categorias a configurar'}</span><Btn size="sm" variant="ghost" onClick={() => setAba('estrutura')}>Ver estrutura</Btn></li>
          <li><AdminIcon name={administradores.length ? 'check' : 'alert'} size={16} /><span>{administradores.length ? administradores.map(m => m.usuario.nome).join(', ') : 'Administrador a definir'}</span><Btn size="sm" variant="ghost" onClick={() => setAba('acessos')}>Ver acessos</Btn>{!administradores.length && <Btn size="sm" onClick={() => setAba('convites')}>Convidar administrador</Btn>}</li>
        </ul>
      </Card>
      <Card className="bloco">
        <h2 className="section-title">Dados do clube</h2>
        <form onSubmit={salvarClube} className="form-grid">
          <Input label="Nome" value={dadosClube.nome} onChange={e => setDadosClube(f => ({ ...f, nome: e.target.value }))} required />
          <Select label="Plano" emptyLabel="Plano" options={PLANOS} value={dadosClube.plano} onChange={e => setDadosClube(f => ({ ...f, plano: e.target.value }))} />
          <Input label="Cidade" value={dadosClube.cidade} onChange={e => setDadosClube(f => ({ ...f, cidade: e.target.value }))} />
          <Input label="UF" maxLength={2} value={dadosClube.estado} onChange={e => setDadosClube(f => ({ ...f, estado: e.target.value }))} />
          <Input className="full" label="Escudo (URL https)" value={dadosClube.escudo} onChange={e => setDadosClube(f => ({ ...f, escudo: e.target.value }))} />
          <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn type="submit">Salvar dados</Btn></div>
        </form>
      </Card>
      </>}

      {aba === 'convites' && <ClubeConvites key={clube.id} clubeId={clube.id} />}
      {aba === 'atividade' && <ClubeAtividade key={clube.id} clubeId={clube.id} />}

      {aba === 'estrutura' && <Card>
        <h2 className="section-title">Estrutura do clube</h2>
        <dl className="admin-club-metrics">
          <div><dt>Jogadores</dt><dd>{clube.jogadores}</dd></div>
          <div><dt>Partidas organizadas</dt><dd>{clube.partidas}</dd></div>
          <div><dt>Competições</dt><dd>{clube.competicoes}</dd></div>
        </dl>
        <h3 className="section-title">Categorias</h3>
        {dados.categorias.length ? <div className="chips">{dados.categorias.map(c => <span key={c.id} className="chip">{c.nome.toUpperCase()}</span>)}</div>
          : <div>
            <p className="dica">Este clube ainda não possui categorias cadastradas.</p>
            <Btn size="sm" disabled={criandoCategorias} onClick={() => void adicionarCategorias()}>{criandoCategorias ? 'Adicionando…' : 'Adicionar categorias padrão'}</Btn>
          </div>}
      </Card>}

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
                    <td><PapelBadge papel={m.papel} /></td>
                    <td>{m.papel === 'ADMIN' || m.acesso_todas_categorias ? 'Todas' : ESCRITA.includes(m.papel) ? m.categorias.length : '—'}</td>
                    <td><div className="actions"><Btn size="sm" variant="ghost" onClick={() => abrirEdicao(m)}>Alterar</Btn><Btn size="sm" variant="danger" onClick={() => setRemocao(m)}>Remover</Btn></div></td>
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
          <Btn variant="danger" disabled={removendo} onClick={() => void remover()}>{removendo ? 'Removendo…' : 'Remover acesso'}</Btn>
        </div>
      </Modal>

      <Modal open={!!edicao} onClose={() => setEdicao(null)} title={edicao ? `Permissão · ${edicao.nome}` : ''}>
        {edicao && (
          <form onSubmit={salvarPapel} className="form-grid">
            <Select className="full" label="Cargo" emptyLabel="Cargo" options={PAPEIS} value={edicao.papel} onChange={e => setEdicao({ ...edicao, papel: e.target.value as PapelClube })} />
            {ESCRITA.includes(edicao.papel) && (
              <label className="full check"><input type="checkbox" checked={edicao.todas} onChange={e => setEdicao({ ...edicao, todas: e.target.checked })} /> Acesso a todas as categorias</label>
            )}
            {exigeCategorias && (
              <fieldset className="full cats">
                <legend className="field-label">Categorias permitidas</legend>
                {dados.categorias.map(c => (
                  <label key={c.id} className="check"><input type="checkbox" checked={edicao.cats.includes(c.id)}
                    onChange={e => setEdicao({ ...edicao, cats: e.target.checked ? [...edicao.cats, c.id] : edicao.cats.filter(x => x !== c.id) })} /> {c.nome}</label>
                ))}
              </fieldset>
            )}
            <div className="full" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn type="button" variant="ghost" onClick={() => setEdicao(null)}>Cancelar</Btn><Btn type="submit">Salvar</Btn>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={adicionando} onClose={() => setAdicionando(false)} title="Adicionar pessoa ao clube">
        <form onSubmit={procurar} className="form-grid">
          <Input className="full" label="Buscar usuário (nome ou e-mail)" value={busca} onChange={e => setBusca(e.target.value)} />
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
