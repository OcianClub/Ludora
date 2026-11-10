import { useEffect, useState } from 'react';
import type { ClubeResumo, MembrosDoClube, PapelClube, UsuarioGlobal } from '@ludora/shared-types';
import { ClubBadge } from '@web/components/Brand';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { Btn, Modal } from './AdminUI';
import { definirPapel, fetchMembros } from '../services/api';
import { OptionTiles } from './OptionTiles';
import { ClubSubChoices } from './ClubeCadastroFields';
import { PAPEIS_CLUBE } from './CargoClube';

export function UsuarioClubeEditor({ conta, clubes, vinculo, onClose, onSaved }: {
  conta: UsuarioGlobal;
  clubes: ClubeResumo[];
  vinculo: UsuarioGlobal['clubes'][number] | null;
  onClose: () => void;
  onSaved: (vinculo: UsuarioGlobal['clubes'][number]) => void;
}) {
  const [clube, setClube] = useState(vinculo ? String(vinculo.clube_id) : '');
  const [busca, setBusca] = useState('');
  const [papel, setPapel] = useState<PapelClube>(vinculo?.papel || 'TORCEDOR');
  const [escopo, setEscopo] = useState({ todas: true, ids: [] as number[] });
  const [dados, setDados] = useState<MembrosDoClube | null>(null);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const clubeSelecionado = clubes.find(c => String(c.id) === clube);
  const escrita = papel === 'TECNICO' || papel === 'MESARIO';
  useEffect(() => {
    setDados(null); setErro('');
    if (!clube) return;
    let ativo = true;
    void fetchMembros(Number(clube)).then(d => {
      if (!ativo) return;
      const membro = d.membros.find(m => m.usuario.id === conta.id);
      setDados(d);
      if (membro) { setPapel(membro.papel); setEscopo({ todas: membro.acesso_todas_categorias, ids: membro.categorias.map(c => c.categoria_id) }); }
      else { setPapel('TORCEDOR'); setEscopo({ todas: true, ids: [] }); }
    }).catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [clube, conta.id]);
  async function salvar() {
    if (!clube || !dados || busy || escrita && !escopo.todas && !escopo.ids.length) return;
    setBusy(true); setErro('');
    try {
      await definirPapel(Number(clube), conta.id, { papel, acesso_todas_categorias: escrita ? escopo.todas : true, categoria_ids: escrita && !escopo.todas ? escopo.ids : [] });
      onSaved({ clube_id: Number(clube), nome: clubeSelecionado?.nome || vinculo?.nome || 'Clube', papel });
    } catch (e) { setErro((e as Error).message); }
    finally { setBusy(false); }
  }
  const disponiveis = clubes.filter(c => !conta.clubes.some(v => v.clube_id === c.id) && (String(c.id) === clube || c.nome.toLowerCase().includes(busca.trim().toLowerCase())));
  return <Modal open title={vinculo ? `Editar acesso · ${vinculo.nome}` : 'Vincular a um clube'} className="chamado-manual-dialog" onClose={() => { if (!busy) onClose(); }}
    footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={busy} onClick={onClose}>Voltar</Btn><Btn disabled={busy || !dados || escrita && !escopo.todas && !escopo.ids.length} onClick={() => void salvar()}>Salvar vínculo</Btn></div>}>
    <div className="chamado-manual-form">
      {!vinculo && <>
        <CollectionSearch label="Buscar clube para vínculo" value={busca} onChange={setBusca} placeholder="Nome do clube…"/>
        <OptionTiles label="Clube Ludora" value={clube} options={disponiveis.map(c => ({ value: c.id, label: c.nome, icon: <ClubBadge src={c.escudo} name={c.nome} size={30}/> }))} onChange={setClube} scroll disabled={busy}/>
        {!disponiveis.length && <p className="dica">Nenhum clube disponível nesta busca.</p>}
      </>}
      {clube && !dados && !erro && <p role="status">Carregando permissões do clube…</p>}
      {dados && <OptionTiles label="Cargo no clube" value={papel} options={[...PAPEIS_CLUBE]} onChange={v => setPapel(v as PapelClube)} disabled={busy}/>}
      {dados && escrita && <fieldset className="option-tiles"><legend>Acesso aos SUBs</legend>
        <div className="paulista-follow"><strong>Todas as categorias</strong><button type="button" className="settings-switch" role="switch" aria-label="Todas as categorias" aria-checked={escopo.todas} onClick={() => setEscopo({ ...escopo, todas: !escopo.todas })}><span className="settings-switch-thumb" aria-hidden="true"/></button></div>
        {!escopo.todas && <ClubSubChoices options={dados.categorias.filter(c => c.ativa || escopo.ids.includes(c.id))} selected={escopo.ids}
          onChange={id => setEscopo({ ...escopo, ids: escopo.ids.includes(id) ? escopo.ids.filter(v => v !== id) : [...escopo.ids, id] })}/>}
      </fieldset>}
      {erro && <p className="notice-error" role="alert">{erro}</p>}
    </div>
  </Modal>;
}
