import { useEffect, useId, useState } from 'react';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { Btn, Input, Modal } from './AdminUI';
import { Icon } from '@web/components/Icon';
import { novoRequestId } from '@web/services/requestId';
import { requestJson } from '../services/api';
import { DesktopSelect } from './DesktopSelect';
import { PlatformClubOption } from './PlatformClubCollection';
import './UserAccountDialog.css';
import './ChamadoManual.css';

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
  const grupoClube = useId();
  const dicaDescricao = useId();
  const [requestId] = useState(novoRequestId);
  const [clubes, setClubes] = useState<{ value: number; label: string; escudo?: string | null }[] | null>(null);
  const [busca, setBusca] = useState('');
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
  return <Modal open title="Novo chamado manual" onClose={() => { if (!busy) onClose(); }} className="desktop-account-dialog desktop-ticket-create"
    footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Btn><Btn type="submit" form="chamado-manual" disabled={!valido || busy}>{busy ? 'Registrando…' : 'Criar chamado'}</Btn></div>}>
    <form id="chamado-manual" className="desktop-ticket-form" onSubmit={salvar} aria-busy={busy}>
      <section className="desktop-ticket-form-section" aria-label="Relato do problema">
        <h3><Icon name="edit" size={17}/>Relato do problema</h3>
        <Input label="Assunto (obrigatório)" placeholder="Ex. Texto sobreposto no placar" value={form.assunto} disabled={busy} required minLength={3} maxLength={120} onChange={e => alterar('assunto', e.target.value)}/>
        <label className="field"><span className="field-label">Descrição</span><textarea className="field-input" aria-label="Descrição" aria-describedby={dicaDescricao} rows={5} required disabled={busy} minLength={10} maxLength={4000} placeholder="O que aconteceu e como reproduzir?" value={form.descricao} onChange={e => alterar('descricao', e.target.value)}/><small id={dicaDescricao}>Descreva o problema sem incluir senhas ou documentos.</small></label>
        <DesktopSelect label="Tipo" showLabel fullWidth expandInDialog options={tipos} value={form.tipo} placeholder="Selecione o tipo" onChange={v => alterar('tipo', v)} disabled={busy}/>
        <DesktopSelect label="Impacto" showLabel fullWidth expandInDialog options={impactos} value={form.impacto} onChange={v => alterar('impacto', v)} disabled={busy}/>
      </section>
      <section className="desktop-ticket-form-section" aria-label="Onde ocorreu">
        <h3><Icon name="location" size={17}/>Onde ocorreu</h3>
        <DesktopSelect label="Plataforma" showLabel fullWidth expandInDialog options={plataformas} value={form.servico} onChange={v => alterar('servico', v)} disabled={busy}/>
        <DesktopSelect label="Tela (obrigatória)" showLabel fullWidth expandInDialog options={telas} value={form.rota} placeholder="Selecione a tela" onChange={v => alterar('rota', v)} disabled={busy}/>
        <fieldset className="desktop-ticket-clubs"><legend>Clube afetado</legend>
          {muitosClubes && <CollectionSearch label="Buscar clube do chamado" placeholder="Buscar clube…" value={busca} onChange={setBusca}/>}
          <div className="desktop-ticket-club-options">
            <label className="platform-club-option platform-club-surface" data-disabled={busy || !clubes}>
              <span className="desktop-ticket-platform"><Icon name="settings" size={19}/></span>
              <span className="platform-club-option-copy"><strong>Plataforma inteira</strong><small>Sem um clube específico</small></span>
              <input type="radio" name={grupoClube} aria-label="Plataforma inteira" checked={!form.clube} onChange={() => alterar('clube', '')} disabled={busy || !clubes}/>
            </label>
            {clubesVisiveis.map(c => <PlatformClubOption key={c.value} clube={{id:c.value,nome:c.label,escudo:c.escudo || null,cidade:null,estado:null}} detail="Clube Ludora"
              name={grupoClube} checked={form.clube === String(c.value)} onSelect={() => alterar('clube', String(c.value))} disabled={busy || !clubes}/>)}
          </div>
          {muitosClubes && !clubesVisiveis.length && <p>Nenhum clube nesta busca.</p>}
        </fieldset>
        {!clubes && !erro && <p role="status">Carregando clubes…</p>}
      </section>
      {erro && <p role="alert" className="notice-error full">{erro}</p>}
      {erro && !clubes && <Btn type="button" variant="ghost" onClick={() => void carregarClubes()}>Tentar carregar clubes</Btn>}
    </form>
  </Modal>;
}
