import { useCallback, useEffect, useState } from 'react';
import { Btn, LoadingSkeleton, Modal } from './AdminUI';
import { Icon } from '@web/components/Icon';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { PlayerRosterCells } from '@web/components/PlayerRosterCells';
import { PlayerProfileHeader, PlayerProfilePanels, type PlayerProfileData } from '@web/components/PlayerProfileContent';
import { PlayerEditDialog, type EditablePlayer } from '@web/components/PlayerEditDialog';
import { ErroJogador, type ConflitoCamisa, type DadosJogador } from '@web/services/api';
import { requestJson } from '../services/api';
import { ExcluirIcone } from './ExcluirIcone';
import { DesktopTable } from './DesktopTable';
import '@web/pages/Jogadores.css';

type Jogador = EditablePlayer & { ativo: boolean };
const POR_PAGINA = 25;

export function ClubeElenco({ clubeId, clubeNome, categoriaId, categoriaNome, podeGerenciar, onCategoria, onAlterado }: {
  clubeId: number; clubeNome: string; categoriaId: number; categoriaNome: string;
  podeGerenciar: boolean;
  onCategoria: (id: number) => void; onAlterado: (mensagem: string) => void;
}) {
  const clubeBase = `/admin/clubes/${clubeId}`;
  const base = `${clubeBase}/categorias/${categoriaId}/jogadores`;
  const [jogadores, setJogadores] = useState<Jogador[] | null>(null);
  const [perfilId, setPerfilId] = useState<number | null>(null);
  const [perfil, setPerfil] = useState<PlayerProfileData | null>(null);
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [erroPerfil, setErroPerfil] = useState('');
  const [erroExclusao, setErroExclusao] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [versao, setVersao] = useState(0);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    let ativa = true;
    setErro(''); setAtualizando(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ busca, offset: String(pagina * POR_PAGINA) });
      requestJson<Jogador[]>(`${base}?${params}`).then(lista => {
        if (!ativa) return;
        if (!lista.length && pagina) setPagina(p => p - 1);
        else setJogadores(lista);
      }).catch(e => { if (ativa) setErro(e.message); }).finally(()=>{if(ativa)setAtualizando(false);});
    }, busca ? 220 : 0);
    return () => { ativa = false; clearTimeout(timer); };
  }, [base, busca, pagina, versao]);

  useEffect(() => {
    if (perfilId === null) return;
    let ativa = true;
    setErroPerfil(''); setPerfil(null);
    requestJson<PlayerProfileData>(`${base}/${perfilId}`).then(dados => { if (ativa) setPerfil(dados); })
      .catch(e => { if (ativa) setErroPerfil(e.message); });
    return () => { ativa = false; };
  }, [base, perfilId, versao]);

  const prever = useCallback((date: string) => requestJson<{ categoria: { nome: string } }>(
    `${clubeBase}/jogadores/categoria?nascimento=${encodeURIComponent(date)}`,
  ), [clubeBase]);

  const salvar = useCallback(async (id: number, dados: DadosJogador) => {
    const r = await window.ludora.api.requisicao<{ categoria_id: number; error?: string; conflito_camisa?: ConflitoCamisa }>('PATCH', `${base}/${id}`, dados);
    if (!r.ok) throw new ErroJogador(r.data.error || 'Não foi possível salvar o jogador.', r.data.conflito_camisa);
    if (r.data.categoria_id !== categoriaId) onCategoria(r.data.categoria_id);
  }, [base, categoriaId, onCategoria]);

  async function remover() {
    if (!perfil || ocupado) return;
    setOcupado(true); setErroExclusao('');
    try {
      const r = await requestJson<{ desativado: boolean; mensagem: string }>(`${base}/${perfil.id}`, { method: 'DELETE' });
      setExcluindo(false);
      if (!r.desativado) setPerfilId(null);
      setVersao(v => v + 1);
      onAlterado(r.mensagem);
    } catch (e) { setErroExclusao((e as Error).message); }
    finally { setOcupado(false); }
  }

  if (perfilId !== null) return <div className="player-profile-page desktop-player-profile">
    <button type="button" className="player-back" onClick={() => { setPerfilId(null); setPerfil(null); }}><Icon name="chevronLeft" size={18}/>Jogadores do {categoriaNome.toUpperCase()}</button>
    {erroPerfil ? <p className="notice-error" role="alert">{erroPerfil}<Btn size="sm" variant="ghost" onClick={() => setVersao(v => v + 1)}>Tentar novamente</Btn></p> : !perfil ? <LoadingSkeleton kind="match"/> : <>
      <PlayerProfileHeader player={perfil} club={clubeNome} actions={podeGerenciar && <>
        <button type="button" className="desktop-icon-action" aria-label="Editar jogador" data-tooltip="Editar jogador" onClick={() => setEditando(true)}><Icon name="edit" size={20}/></button>
        <ExcluirIcone label="Excluir jogador" onClick={() => { setErroExclusao(''); setExcluindo(true); }}/>
      </>}/>
      <PlayerProfilePanels player={perfil}/>
      {editando && <PlayerEditDialog player={perfil} categoryName={perfil.categoria.nome} previewCategory={prever} savePlayer={salvar}
        onClose={() => setEditando(false)} onSaved={() => { setEditando(false); setVersao(v => v + 1); onAlterado('Jogador atualizado.'); }}/>}
      {excluindo && <Modal open title="Excluir jogador?" onClose={() => { if (!ocupado) setExcluindo(false); }}
        footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={ocupado} onClick={() => setExcluindo(false)}>Cancelar</Btn><Btn className="btn-danger-solid" disabled={ocupado} onClick={() => void remover()}>{ocupado ? 'Aguarde…' : 'Confirmar exclusão'}</Btn></div>}>
        <p>O cadastro de <strong>{perfil.nome}</strong> será excluído se estiver sem histórico. Se houver escalações, acontecimentos ou inscrições, o atleta será desativado e os registros serão preservados.</p>
        {erroExclusao && <p role="alert" className="notice-error">{erroExclusao}</p>}
      </Modal>}
    </>}
  </div>;

  return <section className="alunos-page desktop-club-roster" aria-busy={atualizando}>
    <header className="desktop-roster-heading"><div><h2>Jogadores</h2><p>{categoriaNome.toUpperCase()} · {clubeNome}</p></div>
      <CollectionSearch label="Buscar jogador" value={busca} onChange={valor => { setBusca(valor); setPagina(0); }} placeholder="Nome do jogador…"/>
    </header>
    {atualizando && jogadores && <p className="dica" role="status">Atualizando jogadores…</p>}
    {erro && <div className="alunos-error" role="alert">{erro}{jogadores && <span>Exibindo os últimos dados carregados.</span>}<Btn variant="ghost" onClick={() => setVersao(v => v + 1)}>Tentar novamente</Btn></div>}
    {!jogadores ? !erro && <LoadingSkeleton kind="table"/> : !jogadores.length ? <div className="alunos-directory-empty"><Icon name="team" size={26}/><h3>Nenhum jogador encontrado</h3><p>{busca ? 'Experimente outro nome.' : 'Os jogadores cadastrados nesta faixa aparecerão aqui.'}</p></div> : <>
        <DesktopTable label="Tabela de jogadores" className="desktop-club-roster-scroll" tableClassName="desktop-club-roster-table">
          <thead><tr><th scope="col">Camisa</th><th scope="col">Jogador</th><th scope="col">Posição</th><th scope="col">Idade</th><th scope="col"><span className="sr-only">Acessar ficha</span></th></tr></thead>
            <tbody>{jogadores.slice(0, POR_PAGINA).map(j => <tr key={j.id}><PlayerRosterCells player={j} photo
              name={<button type="button" disabled={atualizando} className="alunos-player-link desktop-link-button" onClick={() => setPerfilId(j.id)}>{j.nome}</button>}
              open={<button type="button" disabled={atualizando} className="student-open" onClick={() => setPerfilId(j.id)} aria-label={`Abrir perfil de ${j.nome}`}><Icon name="chevronRight" size={18}/></button>}/>
            </tr>)}</tbody>
        </DesktopTable>
        {(pagina > 0 || jogadores.length > POR_PAGINA) && <nav className="alunos-pagination" aria-label="Páginas de jogadores">
          <p>Página {pagina + 1}</p><div><Btn size="sm" variant="ghost" disabled={atualizando || !pagina} onClick={() => setPagina(p => p - 1)}>Anterior</Btn><Btn size="sm" variant="ghost" disabled={atualizando || jogadores.length <= POR_PAGINA} onClick={() => setPagina(p => p + 1)}>Próxima</Btn></div>
        </nav>}
      </>}
  </section>;
}
