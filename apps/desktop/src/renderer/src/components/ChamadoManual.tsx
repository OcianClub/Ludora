import { useEffect, useState } from 'react';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { Btn, Input, Modal } from './AdminUI';
import { ClubBadge } from '@web/components/Brand';
import { novoRequestId } from '@web/services/requestId';
import { requestJson } from '../services/api';
import { OptionTiles } from './OptionTiles';
import { FilterSelect } from '@web/components/FilterSelect';

const plataformas = [{ value: 'web', label: 'Web' }, { value: 'mobile', label: 'Mobile' }, { value: 'desktop', label: 'Desktop' }];
const telas = [
  { value: '/dashboard', label: 'Visão geral' }, { value: '/partidas', label: 'Partidas' },
  { value: '/competicoes', label: 'Competições' }, { value: '/jogadores', label: 'Jogadores' },
  { value: '/times', label: 'Times' }, { value: '/elenco', label: 'Scout' },
  { value: '/chamados', label: 'Chamados' }, { value: '/login', label: 'Login' }, { value: '/outra', label: 'Outra tela' },
];
const impactos = [
  { value: 'DIFICULDADE', label: 'Dificulta o uso' }, { value: 'OPERACAO_BLOQUEADA', label: 'Impede concluir a ação' },
  { value: 'DUVIDA', label: 'Dúvida ou observação' },
];
const tipos = [{ value: 'ERRO', label: 'Erro técnico ou visual' }, { value: 'CONFIGURACAO', label: 'Configuração' }, { value: 'DUVIDA', label: 'Dúvida' }, { value: 'OUTRO', label: 'Outro' }];

export default function ChamadoManual({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [requestId] = useState(novoRequestId);
  const [clubes, setClubes] = useState<{ value: number; label: string; escudo?: string | null }[] | null>(null);
  const [busca, setBusca] = useState('');
  const [escolhendoClube, setEscolhendoClube] = useState(false);
  const [form, setForm] = useState({ assunto: '', descricao: '', clube: '', servico: 'web', rota: '', impacto: 'DIFICULDADE', tipo: 'ERRO' });
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const valido = !!clubes && !!form.rota && !!form.tipo && form.assunto.trim().length >= 3 && form.descricao.trim().length >= 10;
  async function carregarClubes() {
    setErro('');
    try { setClubes(await requestJson('/admin/equipe/chamados/clubes')); }
    catch (e) { setErro((e as Error).message); }
  }
  useEffect(() => { void carregarClubes(); }, []);
  function alterar(campo: keyof typeof form, valor: string) { setForm(atual => ({ ...atual, [campo]: valor })); }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !valido) return;
    setBusy(true); setErro('');
    try {
      const { id } = await requestJson<{ id: string }>('/admin/equipe/chamados', { method: 'POST',
        body: { ...form, assunto: form.assunto.trim(), descricao: form.descricao.trim(), clubeId: form.clube ? Number(form.clube) : null, requestId },
      });
      onCreated(id);
    } catch (e) { setErro((e as Error).message); }
    finally { setBusy(false); }
  }
  const clubesVisiveis = (clubes || []).filter(c => String(c.value) === form.clube || c.label.toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase()));
  const muitosClubes = !!clubes && clubes.length > 6;
  const clubeSelecionado = clubes?.find(c => String(c.value) === form.clube);
  return <Modal open title="Novo chamado manual" onClose={() => { if (!busy) onClose(); }} className="chamado-manual-dialog desktop-issue-dialog"
    footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Btn><Btn type="submit" form="chamado-manual" disabled={!valido || busy}>{busy ? 'Registrando…' : 'Criar chamado'}</Btn></div>}>
    <form id="chamado-manual" className="chamado-manual-form" onSubmit={salvar}>
      <section className="desktop-issue-section" aria-label="Relato do problema">
        <h3>Relato do problema</h3>
        <Input label="Assunto (obrigatório)" placeholder="Ex. Texto sobreposto no placar" value={form.assunto} required minLength={3} maxLength={120} onChange={e => alterar('assunto', e.target.value)}/>
        <label className="field"><span className="field-label">Descrição</span><textarea className="field-input" rows={4} required minLength={10} maxLength={4000} value={form.descricao} onChange={e => alterar('descricao', e.target.value)}/></label>
        <FilterSelect label="Tipo" options={tipos} value={form.tipo} emptyLabel="Selecione o tipo" overlayInDialog onChange={v => { if (!busy) alterar('tipo', v); }}/>
        <OptionTiles label="Impacto" options={impactos} value={form.impacto} onChange={v => alterar('impacto', v)} disabled={busy}/>
      </section>
      <section className="desktop-issue-section" aria-label="Onde ocorreu">
        <h3>Onde ocorreu</h3>
        <OptionTiles label="Plataforma" options={plataformas} value={form.servico} onChange={v => alterar('servico', v)} disabled={busy}/>
        <FilterSelect label="Tela (obrigatória)" options={telas} value={form.rota} emptyLabel="Selecione a tela" overlayInDialog onChange={v => { if (!busy) alterar('rota', v); }}/>
        {muitosClubes && <div className="chamado-manual-clube">
          <div><strong>Clube afetado</strong><span>{clubeSelecionado?.label || 'Plataforma inteira'}</span></div>
          <Btn type="button" size="sm" variant="ghost" disabled={busy} aria-expanded={escolhendoClube} onClick={() => setEscolhendoClube(v => !v)}>{escolhendoClube ? 'Fechar escolha' : 'Escolher clube'}</Btn>
        </div>}
        {muitosClubes && escolhendoClube && <CollectionSearch label="Buscar clube do chamado" placeholder="Buscar clube…" value={busca} onChange={setBusca}/>}
        {(!muitosClubes || escolhendoClube) && <OptionTiles label={muitosClubes ? 'Escolha um clube' : 'Clube afetado'}
          options={[{ value: '', label: 'Plataforma inteira' }, ...clubesVisiveis.map(c => ({ ...c, icon: <ClubBadge src={c.escudo} name={c.label} size={28}/> }))]}
          value={form.clube} onChange={v => alterar('clube', v)} disabled={busy || !clubes} scroll/>}
        {!clubes && !erro && <p role="status">Carregando clubes…</p>}
      </section>
      {erro && <p role="alert" className="notice-error full">{erro}</p>}
      {erro && !clubes && <Btn type="button" variant="ghost" onClick={() => void carregarClubes()}>Tentar carregar clubes</Btn>}
    </form>
  </Modal>;
}
