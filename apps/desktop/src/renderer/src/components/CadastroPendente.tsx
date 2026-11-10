import { useEffect, useState } from 'react';
import { Btn, Card, Input, Modal, Spinner } from './AdminUI';
import { Toast } from '@web/components/Toast';
import { FilterSelect } from '@web/components/FilterSelect';
import { Icon } from '@web/components/Icon';
import { requestJson } from '../services/api';

type Tarefa = { id: string; motivo: string; estado: string; mensagem: string; criadoEm: string; destinatarios: number[]; justificativa?: string };
type Clube = { id: number; nome: string; ativo: boolean; motivos: { value: string; label: string; mensagem: string }[]; tarefas: Tarefa[] };
type Destinatario = { id: number; nome: string };
const endpoint = '/admin/cadastro-pendente';
const estados: Record<string, string> = { PENDENTE: 'Pendente', CONCLUIDA: 'Concluída', DISPENSADA: 'Dispensada' };
const tipos: Record<string, string> = { ESCUDO: 'Escudo', ENDERECO: 'Endereço', CNPJ: 'CNPJ' };

export default function CadastroPendente() {
  const [clubes, setClubes] = useState<Clube[] | null>(null);
  const [id, setId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [pessoas, setPessoas] = useState<Destinatario[] | null>(null);
  const [ids, setIds] = useState<number[]>([]);
  const [modal, setModal] = useState<'enviar' | Tarefa | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function carregar() { setClubes(await requestJson<Clube[]>(endpoint)); }
  useEffect(() => { void carregar().catch(e => setErro(e.message)); }, []);
  useEffect(() => {
    let atual = true;
    setPessoas(null); setIds([]); setMotivo('');
    if (id) void requestJson<Destinatario[]>(`${endpoint}/${id}/destinatarios`).then(dados => { if (atual) setPessoas(dados); }).catch(e => { if (atual) { setErro(e.message); setPessoas([]); } });
    return () => { atual = false; };
  }, [id]);
  const clube = clubes?.find(c => String(c.id) === id);
  const pendencias = clube?.motivos.filter(m => !clube.tarefas.some(t => t.motivo === m.value)) || [];
  const mensagem = pendencias.find(p => p.value === motivo)?.mensagem;
  async function confirmar() {
    if (!modal || ocupado) return;
    setOcupado(true); setErro(''); setAviso('');
    try {
      if (modal === 'enviar') {
        const r = await requestJson<{ caixasAtualizadas: number }>(`${endpoint}/${id}`, { method: 'POST', body: { motivo, destinatarios: ids, mensagemEsperada: mensagem } });
        setAviso(`Aviso registrado em ${r.caixasAtualizadas} central(is) de notificações.`);
        setMotivo(''); setIds([]);
      } else {
        await requestJson(`${endpoint}/tarefas/${modal.id}/dispensar`, { method: 'PATCH', body: { motivo: justificativa } });
        setAviso('Tarefa dispensada.');
      }
      setModal(null); await carregar();
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }
  return <div className="ticket-detail-main">
    {erro && !modal && <p className="notice-error" role="alert">{erro}</p>}<Toast message={aviso} onClose={() => setAviso('')}/>
    <Card className="ticket-section"><h2>Cadastro a completar</h2><p>Envie um aviso pela central de notificações a administradores escolhidos do clube.</p>
      {!clubes && !erro ? <Spinner/> : <FilterSelect label="Clube" emptyLabel="Escolha o clube" options={(clubes || []).filter(c => c.motivos.length || c.tarefas.length).map(c => ({ value: c.id, label: c.nome }))} value={id} onChange={setId}/>}
      {clube && !clube.ativo && <p>O clube está desativado. Reative antes de criar novos avisos.</p>}
      {clube?.ativo && (pendencias.length ? <>
        <FilterSelect label="Dado pendente" emptyLabel="Escolha o dado a atualizar" options={pendencias} value={motivo} onChange={setMotivo}/>
        {pessoas === null ? <Spinner/> : pessoas.length ? <fieldset className="club-subs"><legend>Quem recebe o aviso</legend><div>{pessoas.map(p => <button key={p.id} aria-pressed={ids.includes(p.id)} onClick={() => setIds(a => a.includes(p.id) ? a.filter(v => v !== p.id) : [...a, p.id])}>{p.nome}</button>)}</div></fieldset> : <p>Este clube não tem administrador ativo.</p>}
        <div><Btn disabled={!mensagem || !ids.length} onClick={() => { setErro(''); setModal('enviar'); }}>Revisar aviso</Btn></div>
      </> : <p>Os dados estão completos ou já têm tarefa registrada.</p>)}
    </Card>
    {clube && <section className="ticket-day" aria-label="Tarefas de cadastro"><h2>Acompanhamento</h2>{!clube.tarefas.length && <p className="dica">Nenhum aviso registrado para este clube.</p>}
      {clube.tarefas.map(t => <Card className="ticket-section" key={t.id}><h2>{tipos[t.motivo]} · {estados[t.estado] || t.estado}</h2><p>{t.mensagem}</p><small>{new Date(t.criadoEm).toLocaleDateString('pt-BR')} · {t.destinatarios.length} caixa(s) de entrada atualizada(s)</small>
        {t.justificativa && <p>{t.justificativa}</p>}{t.estado === 'PENDENTE' && <div><Btn variant="ghost" onClick={() => { setErro(''); setJustificativa(''); setModal(t); }}>Dispensar tarefa</Btn></div>}</Card>)}
    </section>}
    {modal && <Modal open title={modal === 'enviar' ? 'Revisar aviso' : 'Dispensar tarefa?'} onClose={() => { if (!ocupado) setModal(null); }} className="schedule-review-dialog"
      footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={ocupado} onClick={() => setModal(null)}>Voltar</Btn><Btn disabled={ocupado || modal !== 'enviar' && justificativa.trim().length < 10} onClick={() => void confirmar()}>{ocupado ? 'Registrando…' : modal === 'enviar' ? 'Enviar aviso' : 'Confirmar dispensa'}</Btn></div>}>
      {modal === 'enviar' ? <div className="schedule-review"><p><Icon name="bell" size={17}/> Central de notificações · {clube?.nome}</p><h3>Cadastro do clube incompleto</h3><p>{mensagem}</p><p>Destinatários: {pessoas?.filter(p => ids.includes(p.id)).map(p => p.nome).join(', ')}</p></div> : <Input label="Justificativa" value={justificativa} maxLength={300} onChange={e => setJustificativa(e.target.value)}/>}
      {erro && <p className="notice-error" role="alert">{erro}</p>}
    </Modal>}
  </div>;
}
