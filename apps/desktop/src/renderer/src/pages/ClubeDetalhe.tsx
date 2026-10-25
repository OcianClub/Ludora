import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MembroClube, MembrosDoClube, PapelClube, PlanoClube, UsuarioGlobal, VisaoGlobal } from '@ludora/shared-types';
import { Btn, Card, Empty, Input, Modal, PapelBadge, Select, Spinner } from '@web/components/UI';
import { atualizarClube, definirPapel, fetchMembros, fetchUsuarios, fetchVisaoGlobal, removerVinculo } from '../services/api';
import { PLANOS } from './Clubes';

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

  async function remover(m: MembroClube) {
    if (!confirm(`Remover ${m.usuario.nome} deste clube?`)) return;
    try { await removerVinculo(clubeId, m.usuario.id); ok('Vínculo removido.'); } catch (err) { falha(err); }
  }

  async function procurar(e: React.FormEvent) {
    e.preventDefault();
    try { setAchados(await fetchUsuarios(busca)); } catch (err) { falha(err); }
  }

  if (!dados || !clube) return erro ? <div className="notice-error" role="alert">{erro}</div> : <Spinner />;
  const idsMembros = new Set(dados.membros.map(m => m.usuario.id));
  const exigeCategorias = edicao && ESCRITA.includes(edicao.papel) && !edicao.todas;

  return (
    <div>
      <Link to="/clubes" className="voltar">← Clubes</Link>
      <div className="page-header"><div><h1 className="page-title">{clube.nome}</h1><p className="page-sub">{clube.membros} membros · {clube.jogadores} jogadores · {clube.partidas} partidas</p></div></div>
      {erro && <div className="notice-error" role="alert">{erro}</div>}
      {aviso && <div className="notice-ok" role="status">{aviso}</div>}

      <Card>
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

      <Card className="bloco">
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
                    <td><div className="actions"><Btn size="sm" variant="ghost" onClick={() => abrirEdicao(m)}>Alterar</Btn><Btn size="sm" variant="danger" onClick={() => void remover(m)}>Remover</Btn></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
