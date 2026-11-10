import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ClubeResumo } from '@ludora/shared-types';
import { Btn, DesktopSection, DesktopState, Input, LoadingSkeleton, Modal, Spinner } from './AdminUI';
import { Toast } from '@web/components/Toast';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { Icon, type IconName } from '@web/components/Icon';
import { requestJson } from '../services/api';
import { DesktopSelect } from './DesktopSelect';
import { PlatformClubOption } from './PlatformClubCollection';
import './UserAccountDialog.css';
import './CadastroPendente.css';

type Tarefa = { id: string; motivo: string; estado: string; mensagem: string; criadoEm: string; destinatarios: number[]; justificativa?: string };
type Clube = { id: number; nome: string; ativo: boolean; motivos: { value: string; label: string; mensagem: string }[]; tarefas: Tarefa[] };
type Destinatario = { id: number; nome: string };
const endpoint = '/admin/cadastro-pendente';
const estados: Record<string, string> = { PENDENTE: 'Pendente', CONCLUIDA: 'Concluída', DISPENSADA: 'Dispensada' };
const tipos: Record<string, string> = { ESCUDO: 'Escudo', ENDERECO: 'Endereço', CNPJ: 'CNPJ' };
const icons: Record<string, IconName> = { ESCUDO: 'shield', ENDERECO: 'location', CNPJ: 'table' };
const motivosDispensa = [
  { value: 'DIRETO', label: 'Tratamento direto pela equipe', texto: 'A pendência será tratada diretamente pela equipe Ludora.' },
  { value: 'ENGANO', label: 'Aviso registrado por engano', texto: 'Este aviso de cadastro foi registrado por engano.' },
  { value: 'NAO_APLICAVEL', label: 'Dado não se aplica ao clube', texto: 'Este dado não se aplica ao cadastro deste clube.' },
  { value: 'OUTRO', label: 'Outro', texto: '' },
];

export default function CadastroPendente({ resumos = [] }: { resumos?: readonly ClubeResumo[] }) {
  const grupo = useId();
  const montado = useRef(true);
  const [clubes, setClubes] = useState<Clube[] | null>(null);
  const [busca, setBusca] = useState('');
  const [id, setId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [pessoas, setPessoas] = useState<Destinatario[] | null>(null);
  const [erroPessoas, setErroPessoas] = useState('');
  const [tentativaPessoas, setTentativaPessoas] = useState(0);
  const [ids, setIds] = useState<number[]>([]);
  const [modal, setModal] = useState<'enviar' | Tarefa | null>(null);
  const [dispensa, setDispensa] = useState('');
  const [outroMotivo, setOutroMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [erroConsulta, setErroConsulta] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const carregar = useCallback(async () => {
    setAtualizando(true); setErroConsulta('');
    try {
      const dados = await requestJson<Clube[]>(endpoint);
      if (montado.current) setClubes(dados);
    } catch (e) { if (montado.current) setErroConsulta((e as Error).message); }
    finally { if (montado.current) setAtualizando(false); }
  }, []);
  useEffect(() => { montado.current = true; void carregar(); return () => { montado.current = false; }; }, [carregar]);
  useEffect(() => {
    let atual = true;
    setPessoas(null); setIds([]); setMotivo(''); setErroPessoas(''); setErro('');
    if (id) void requestJson<Destinatario[]>(`${endpoint}/${id}/destinatarios`)
      .then(dados => { if (atual) setPessoas(dados); })
      .catch(e => { if (atual) setErroPessoas(e.message); });
    return () => { atual = false; };
  }, [id, tentativaPessoas]);
  const pendentes = clubes?.filter(c => c.motivos.length > 0) || [];
  const visiveis = pendentes.filter(c => c.nome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')));
  const clube = pendentes.find(c => String(c.id) === id);
  const novasPendencias = clube?.motivos.filter(m => !clube.tarefas.some(t => t.motivo === m.value)) || [];
  const mensagem = novasPendencias.find(p => p.value === motivo)?.mensagem;
  const justificativa = dispensa === 'OUTRO' ? outroMotivo.trim() : motivosDispensa.find(m => m.value === dispensa)?.texto || '';
  const podeEnviar = !!clube?.ativo && !!mensagem && !erroPessoas && ids.length > 0;

  async function confirmar() {
    if (!modal || ocupado || modal === 'enviar' && !podeEnviar || modal !== 'enviar' && justificativa.length < 10) return;
    setOcupado(true); setErro(''); setAviso('');
    try {
      if (modal === 'enviar') {
        const r = await requestJson<{ caixasAtualizadas: number }>(`${endpoint}/${id}`, { method: 'POST', body: { motivo, destinatarios: ids, mensagemEsperada: mensagem } });
        if (!montado.current) return;
        setAviso(`Aviso enviado para ${r.caixasAtualizadas} ${r.caixasAtualizadas === 1 ? 'administrador' : 'administradores'}.`);
        setMotivo(''); setIds([]);
      } else {
        await requestJson(`${endpoint}/tarefas/${modal.id}/dispensar`, { method: 'PATCH', body: { motivo: justificativa } });
        if (!montado.current) return;
        setAviso('Tarefa dispensada.');
      }
      setModal(null); await carregar();
    } catch (e) { if (montado.current) setErro((e as Error).message); }
    finally { if (montado.current) setOcupado(false); }
  }

  if (!clubes) return erroConsulta
    ? <DesktopState error title="Não foi possível consultar os cadastros" description={erroConsulta} onRetry={carregar}/>
    : <LoadingSkeleton kind="cards" count={3} label="Conferindo pendências dos clubes"/>;

  return <div className="desktop-registration">
    <Toast message={aviso} onClose={() => setAviso('')}/>
    {erroConsulta && <div className="notice-error" role="alert">Não foi possível atualizar as pendências. Os últimos dados continuam visíveis. <Btn size="sm" variant="ghost" disabled={atualizando} onClick={carregar}>Tentar novamente</Btn></div>}
    {!pendentes.length ? <div className="registration-empty"><DesktopState icon="check" title="Nenhum clube possui pendências" description="Os cadastros consultados estão completos." action={<Btn size="sm" variant="ghost" disabled={atualizando} onClick={carregar}><Icon name="refresh" size={15}/>{atualizando ? 'Atualizando…' : 'Atualizar'}</Btn>}/></div> : <>
      <div className="registration-toolbar"><CollectionSearch label="Buscar clube com pendências" placeholder="Nome do clube…" value={busca} onChange={setBusca}/>
        <Btn variant="ghost" disabled={atualizando} onClick={carregar}><Icon name="refresh" size={16}/>{atualizando ? 'Atualizando…' : 'Atualizar'}</Btn></div>
      <p className="registration-count"><strong>{pendentes.length} {pendentes.length === 1 ? 'clube com pendências' : 'clubes com pendências'}</strong><span>Selecione um clube para revisar o cadastro.</span></p>
      <fieldset className="registration-clubs"><legend className="sr-only">Clubes com pendências</legend>
        {visiveis.map(c => { const resumo = resumos.find(r => r.id === c.id); return <PlatformClubOption key={c.id}
          clube={{ id: c.id, nome: c.nome, escudo: resumo?.escudo || null, cidade: resumo?.cidade || null, estado: resumo?.estado || null }}
          detail={c.motivos.map(m => tipos[m.value] || m.label).join(' · ')} name={grupo} checked={id === String(c.id)} onSelect={() => setId(String(c.id))} disabled={ocupado}/>; })}
      </fieldset>
      {!visiveis.length && <DesktopState icon="search" title="Nenhum clube nesta busca" description="Tente outro nome."/>}
      {clube && <div className="registration-content">
        <DesktopSection title="Cadastro a completar" description={clube.nome} className="registration-form-section">
          <p className="registration-intro">Avise os administradores sobre os dados que precisam de atualização.</p>
          <div className="registration-pending"><strong>Pendências do cadastro</strong><ul className="registration-missing" aria-label="Dados pendentes">{clube.motivos.map(m => <li key={m.value}><Icon name={icons[m.value] || 'info'} size={17}/><span><strong>{tipos[m.value] || m.label}</strong><small>A completar</small></span></li>)}</ul></div>
          {!clube.ativo ? <p className="registration-note">Clube desativado. Reative-o antes de enviar novos avisos.</p> : novasPendencias.length ? <>
            <DesktopSelect label="Dado pendente" showLabel fullWidth placeholder="Escolha o dado a atualizar" options={novasPendencias.map(m => ({ ...m, icon: <Icon name={icons[m.value] || 'info'} size={15}/> }))} value={motivo} onChange={setMotivo} disabled={ocupado}/>
            <fieldset className="registration-recipients" disabled={ocupado}><legend>Quem recebe o aviso</legend>
              {erroPessoas ? <div role="alert"><p>Não foi possível consultar os administradores.</p><Btn variant="ghost" size="sm" onClick={() => setTentativaPessoas(n => n + 1)}>Tentar novamente</Btn></div>
                : pessoas === null ? <Spinner label="Consultando administradores…"/> : pessoas.length ? <div>{pessoas.map(p => <label key={p.id}>
                  <input type="checkbox" checked={ids.includes(p.id)} onChange={() => setIds(a => a.includes(p.id) ? a.filter(v => v !== p.id) : [...a, p.id])}/>
                  <span className="registration-person-avatar" aria-hidden="true">{p.nome.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span><span>{p.nome}</span>
                </label>)}</div> : <p className="registration-note">Este clube não tem administrador ativo.</p>}
            </fieldset>
            {mensagem && <div className="registration-preview"><span><Icon name="bell" size={15}/>Mensagem do aviso</span><p>{mensagem}</p></div>}
            <div className="registration-form-actions"><Btn disabled={ocupado || !podeEnviar} onClick={() => { setErro(''); setModal('enviar'); }}>Revisar aviso<Icon name="chevronRight" size={16}/></Btn></div>
          </> : <p className="registration-note">Os dados pendentes já possuem aviso registrado. Consulte a seção Acompanhamento.</p>}
        </DesktopSection>
        <DesktopSection title="Acompanhamento" description="Avisos deste clube e suas resoluções." className="registration-history-section">
          {!clube.tarefas.length ? <div className="registration-history-empty"><Icon name="bell" size={24}/><p>Nenhum aviso registrado para este clube.</p></div> : <ol className="registration-history">{[...clube.tarefas].sort((a,b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm)).map(t => <li key={t.id}>
            <div className="registration-task-heading"><span><Icon name={icons[t.motivo] || 'info'} size={16}/><strong>{tipos[t.motivo] || t.motivo}</strong></span><span className="registration-task-status" data-state={t.estado}>{estados[t.estado] || t.estado}</span></div>
            <p>{t.mensagem}</p><small>{new Date(t.criadoEm).toLocaleDateString('pt-BR')} · {t.destinatarios.length} {t.destinatarios.length === 1 ? 'destinatário' : 'destinatários'}</small>
            {t.justificativa && <div className="registration-task-reason"><strong>Motivo da dispensa</strong><p>{t.justificativa}</p></div>}
            {t.estado === 'PENDENTE' && <Btn size="sm" variant="ghost" disabled={ocupado} onClick={() => { setErro(''); setDispensa(''); setOutroMotivo(''); setModal(t); }}>Dispensar tarefa</Btn>}
          </li>)}</ol>}
        </DesktopSection>
      </div>}
    </>}
    {modal && <Modal open title={modal === 'enviar' ? 'Revisar aviso' : 'Dispensar tarefa'} onClose={() => { if (!ocupado) setModal(null); }} className="desktop-account-dialog registration-review-dialog"
      footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={ocupado} onClick={() => setModal(null)}>Voltar</Btn><Btn disabled={ocupado || (modal === 'enviar' ? !podeEnviar : justificativa.length < 10)} onClick={() => void confirmar()}>{ocupado ? 'Registrando…' : modal === 'enviar' ? 'Enviar aviso' : 'Confirmar dispensa'}</Btn></div>}>
      {modal === 'enviar' ? <div className="registration-review"><span className="registration-review-club"><Icon name="bell" size={18}/>{clube?.nome}</span><h3>Cadastro do clube incompleto</h3><p>{mensagem}</p><div><strong>Destinatários</strong><p>{pessoas?.filter(p => ids.includes(p.id)).map(p => p.nome).join(', ')}</p></div></div> : <div className="registration-review">
        <div><strong>{clube?.nome} · {tipos[modal.motivo] || modal.motivo}</strong><p>A dispensa encerra o aviso, sem preencher nem alterar o cadastro do clube.</p></div>
        <DesktopSelect label="Motivo da dispensa" placeholder="Selecione o motivo" showLabel fullWidth expandInDialog value={dispensa} options={motivosDispensa} onChange={setDispensa} disabled={ocupado}/>
        {dispensa === 'OUTRO' && <Input label="Descreva o motivo" value={outroMotivo} maxLength={300} placeholder="Pelo menos 10 caracteres" onChange={e => setOutroMotivo(e.target.value)} disabled={ocupado}/>}
      </div>}
      {erro && <p className="notice-error" role="alert">{erro}</p>}
    </Modal>}
  </div>;
}
