import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSupport } from '../contexts/SupportContext';
import { novoRequestId } from '../services/requestId';
import { requestJson } from '../services/api';
import { CollectionViewToggle } from './CollectionToolbar';
import { FilterSelect } from './FilterSelect';
import { Btn, Input, Modal, Spinner } from './UI';
import { Icon } from './Icon';
import './SupportButton.css';

export const SUPPORT_STATUS: Record<string, string> = {
  NOVO: 'Novo', EM_TRIAGEM: 'Em triagem', AGUARDANDO_CLIENTE: 'Aguardando sua resposta', EM_ANDAMENTO: 'Em andamento',
  ENCAMINHADO_DEVS: 'Com os desenvolvedores', RESOLVIDO: 'Resolvido', REABERTO: 'Reaberto',
};
const orientacoes = {
  ERRO: { label: 'Erro ou lentidão', pergunta: 'O que aconteceu?', exemplo: 'Diga o que tentou fazer e o que aconteceu no lugar do esperado.' },
  CONVITE: { label: 'Convite', pergunta: 'O que aconteceu com o convite?', exemplo: 'Informe em que etapa o convite deixou de funcionar.' },
  RECUPERACAO: { label: 'Acesso à conta', pergunta: 'O que impede você de entrar?', exemplo: 'Descreva o que tentou e a mensagem que apareceu.' },
  CONFIGURACAO: { label: 'Configuração', pergunta: 'O que você quer configurar?', exemplo: 'Diga o que quer fazer e onde encontrou dificuldade.' },
  DUVIDA: { label: 'Dúvida', pergunta: 'Como podemos ajudar?', exemplo: 'Conte o que você quer fazer ou entender.' },
  SEGURANCA: { label: 'Segurança', pergunta: 'O que chamou sua atenção?', exemplo: 'Descreva a atividade suspeita e quando ela ocorreu.' },
  OUTRO: { label: 'Outro', pergunta: 'O que aconteceu?', exemplo: 'Descreva o que precisa de ajuda para resolver.' },
};
type TipoAjuda = keyof typeof orientacoes;
const tipos = (Object.keys(orientacoes) as TipoAjuda[]).map(value => ({ value, label: orientacoes[value].label }));
const situacoes: Partial<Record<TipoAjuda, string[]>> = {
  CONVITE: ['Não recebi o convite', 'O código expirou', 'Não consegui aceitar'],
  RECUPERACAO: ['Esqueci minha senha', 'Não recebi o e-mail de recuperação', 'Perdi acesso ao meu e-mail'],
};
const impactos = [{ value: 'DUVIDA', label: 'Tenho uma dúvida' }, { value: 'DIFICULDADE', label: 'Consigo usar com dificuldade' }, { value: 'OPERACAO_BLOQUEADA', label: 'Não consigo concluir a ação' }];
type Resposta = { id?: number; acao?: string; motivo: string; criadoEm: string };
type Chamado = {
  id: string; assunto: string; descricao?: string; status: string; criadoEm: string;
  ultimaResposta?: Resposta | null; historico?: Resposta[];
};
const vazio = { assunto: '', descricao: '', tipo: 'OUTRO' as TipoAjuda, impacto: 'DIFICULDADE', situacao: '', passos: '' };
const titulosHistorico: Record<string, string> = {
  RESPOSTA_CLIENTE: 'Você', COMENTAR: 'Equipe Ludora', FINALIZAR: 'Conclusão do atendimento', STATUS: 'Atualização do atendimento',
};
const nomesPaginas: Record<string, string> = {
  dashboard: 'Visão geral', partidas: 'Partidas', scout: 'Scout', jogadores: 'Jogadores', clubes: 'Clubes',
  times: 'Times', competicoes: 'Competições', paulista: 'Campeonato Paulista', membros: 'Pessoas e acessos',
  perfil: 'Perfil', configuracoes: 'Configurações do clube', solicitacoes: 'Solicitações',
};
const versao = import.meta.env.VITE_APP_VERSION || 'desenvolvimento';
const data = (valor: string) => new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function SupportButton({ variant = 'menu' }: { variant?: 'sidebar' | 'menu' }) {
  const { token } = useAuth();
  const { abrirSuporte, naoLidos } = useSupport();
  if (!token) return null;
  return <button type="button" className={`support-trigger ${variant === 'sidebar' ? 'nav-item' : 'mobile-more-item'}`}
      aria-label="Suporte e ajuda" aria-haspopup="dialog" data-tooltip="Suporte e ajuda" data-tooltip-icon-only onClick={() => abrirSuporte()}>
      <span className={variant === 'sidebar' ? 'nav-icon' : 'mobile-more-item-icon'}><Icon name="headset" />{naoLidos > 0 && <span className="support-unread-dot" title="Novas respostas do suporte" />}</span>
      <span className={variant === 'sidebar' ? 'nav-label' : undefined}>Suporte e ajuda</span>
      {variant === 'menu' && <Icon name="chevronRight" size={18} />}
    </button>;
}

export function SupportDialog({ open, chamadoInicial, iniciarNoHistorico, onClose }: {
  open: boolean; chamadoInicial?: string; iniciarNoHistorico?: boolean; onClose: () => void;
}) {
  const { token, clubeSelecionado } = useAuth();
  const { avisos, pendentes, marcarVisto } = useSupport();
  const { pathname } = useLocation();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(chamadoInicial || iniciarNoHistorico));
  const [error, setError] = useState('');
  const [erroConsulta, setErroConsulta] = useState('');
  const [message, setMessage] = useState('');
  const [lista, setLista] = useState<Chamado[]>([]);
  const [detalhe, setDetalhe] = useState<Chamado | null>(null);
  const [detalheId, setDetalheId] = useState(chamadoInicial);
  const [aba, setAba] = useState<'novo' | 'historico'>(chamadoInicial || iniciarNoHistorico ? 'historico' : 'novo');
  const [resposta, setResposta] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [form, setForm] = useState(vazio);
  const [requestId, setRequestId] = useState(() => novoRequestId());
  const [reload, setReload] = useState(0);
  // Visitantes relatam problemas da própria conta, sem alegar vínculo com o clube visitado.
  const semClube = !clubeSelecionado?.meuPapel;
  const pagina = location.origin + pathname;
  const paginaNome = nomesPaginas[pathname.split('/')[1]] || pathname;
  const orientacao = orientacoes[form.tipo];
  const situacoesDoTipo = situacoes[form.tipo];
  const chamadoAtual = detalhe?.id === detalheId ? detalhe : null;
  const novoAviso = detalheId ? avisos[detalheId] || 0 : 0;
  const outrosAvisos = Object.keys(pendentes).some(chamadoId => chamadoId !== detalheId);
  const [novaResposta, setNovaResposta] = useState(0);
  useEffect(() => {
    if (!open) return;
    setError(''); setErroConsulta(''); setMessage('');
    if (chamadoInicial || iniciarNoHistorico) {
      setLoading(true); setDetalheId(chamadoInicial); setDetalhe(null);
      setAba('historico'); setResposta(''); setNovaResposta(0); setEnviado(false);
    }
  }, [open, chamadoInicial, iniciarNoHistorico]);
  useEffect(() => {
    if (!open || aba !== 'historico' || detalheId || !token) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      requestJson<Chamado[]>('/suporte', { cache: 'no-store', signal: controller.signal, semClube })
        .then(value => { if (!controller.signal.aborted) { setLista(value); setErroConsulta(''); } })
        .catch(e => { if (!controller.signal.aborted) setErroConsulta((e as Error).message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 100);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, aba, detalheId, reload, token, semClube, avisos]);

  useEffect(() => {
    if (!open || aba !== 'historico' || !detalheId || !token || enviado || busy) return;
    const controller = new AbortController();
    requestJson<Chamado>(`/suporte/${detalheId}`, { cache: 'no-store', signal: controller.signal, semClube })
      .then(value => {
        if (controller.signal.aborted) return;
        if (novoAviso > 0 && pendentes[detalheId] === novoAviso && value.historico?.some(item => item.id === novoAviso)) setNovaResposta(novoAviso);
        setDetalhe(value);
        setErroConsulta('');
      })
      .catch(e => { if (!controller.signal.aborted) setErroConsulta((e as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, aba, detalheId, reload, token, semClube, enviado, busy, novoAviso]);

  useEffect(() => {
    if (!open || aba !== 'historico' || enviado || !chamadoAtual?.historico) return;
    const respostaId = chamadoAtual.historico.reduce((maior, item) =>
      ['COMENTAR', 'FINALIZAR', 'STATUS'].includes(item.acao || '') ? Math.max(maior, item.id || 0) : maior, 0);
    const marcar = () => marcarVisto(chamadoAtual.id, respostaId);
    marcar();
    document.addEventListener('visibilitychange', marcar);
    return () => document.removeEventListener('visibilitychange', marcar);
  }, [open, aba, enviado, chamadoAtual, marcarVisto]);
  if (!token) return null;

  function fechar() { if (!busy) onClose(); }
  async function copiarPagina() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(pagina); setMessage('Endereço copiado.');
    } catch { setError('Não foi possível copiar o endereço.'); }
  }
  function voltarALista() {
    setLoading(true); setError(''); setErroConsulta(''); setMessage(''); setDetalheId(undefined); setDetalhe(null);
    setResposta(''); setNovaResposta(0);
  }
  function trocarAba(value: string) {
    if (busy || (value === aba && !enviado)) return;
    voltarALista();
    setLoading(value === 'historico'); setEnviado(false);
    setAba(value === 'novo' ? 'novo' : 'historico');
  }
  async function enviar(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (form.assunto.trim().length < 3 || form.descricao.trim().length < 10 || !form.tipo || !form.impacto) {
      setError('Informe um assunto com pelo menos 3 caracteres e descreva o ocorrido em pelo menos 10 caracteres.'); return;
    }
    const descricao = [
      form.descricao.trim(),
      form.situacao && 'Situação: ' + form.situacao,
      form.tipo === 'ERRO' && form.passos.trim() && 'Passos para reproduzir:\n' + form.passos.trim(),
    ].filter(Boolean).join('\n\n');
    if (descricao.length > 4000) {
      setError('A descrição e as informações adicionais devem somar até 4.000 caracteres.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const chamado = await requestJson<Chamado>('/suporte', {
        method: 'POST', semClube,
        body: JSON.stringify({ assunto: form.assunto.trim(), descricao, tipo: form.tipo, impacto: form.impacto, requestId, rota: pathname, versao }),
      });
      setLista(atual => [chamado, ...atual.filter(item => item.id !== chamado.id)]);
      setDetalhe(chamado); setDetalheId(chamado.id); setAba('historico'); setEnviado(true);
      setForm(vazio); setRequestId(novoRequestId());
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function consultar(chamado: Chamado) {
    setError(''); setErroConsulta(''); setMessage(''); setLoading(true);
    setDetalheId(chamado.id);
    setResposta(''); setNovaResposta(0);
  }
  async function responder(event: React.FormEvent) {
    event.preventDefault(); if (busy || !chamadoAtual || resposta.trim().length < 5) return;
    setBusy(true); setError('');
    try {
      await requestJson(`/suporte/${chamadoAtual.id}/responder`, { method: 'POST', semClube, body: JSON.stringify({ mensagem: resposta.trim() }) });
      setResposta('');
      setMessage('Resposta enviada.');
      setReload(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <Modal open={open} title="Suporte e ajuda" className="support-dialog" onClose={fechar}
    footer={aba === 'novo' ? <div className="support-actions"><Btn variant="ghost" disabled={busy} onClick={fechar}>Cancelar</Btn><Btn type="submit" form={`${id}-novo`} disabled={busy}>{busy ? 'Enviando…' : 'Enviar chamado'}<Icon name="arrow" size={16} /></Btn></div> : undefined}>
    <CollectionViewToggle label="Atendimento" value={aba} onChange={trocarAba} className="support-tabs"
      options={[{ value: 'novo', label: 'Novo chamado', icon: 'plus' }, { value: 'historico', label: 'Meus chamados', icon: 'clock' }]} />
    {error && <p className="support-feedback support-error" role="alert"><Icon name="alert" size={18} />{error}</p>}
    {erroConsulta && <div className="support-query-error">
      <p className="support-feedback support-error" role="alert"><Icon name="alert" size={18} />{erroConsulta}</p>
      <Btn variant="ghost" onClick={() => setReload(value => value + 1)}>Tentar novamente</Btn>
    </div>}
    {message && <p className="support-feedback support-success" role="status"><Icon name="checkAll" size={18} />{message}</p>}
    {outrosAvisos && (aba === 'novo' || detalheId) && <p className="support-new-reply" role="status">
      <Icon name="bell" size={16} />Há novas respostas em Meus chamados.
    </p>}
    {aba === 'novo' ? <>
      <div className="support-intro"><strong>Com o que você precisa de ajuda?</strong></div>
      <form id={`${id}-novo`} onSubmit={enviar} className="support-form" aria-busy={busy}>
        <fieldset disabled={busy}>
          <div className="support-selects">
            <FilterSelect overlayInDialog label="Tipo de ajuda" emptyLabel="Escolha um tipo" value={form.tipo} options={tipos}
              onChange={tipo => setForm(atual => ({ ...atual, tipo: (tipo || 'OUTRO') as TipoAjuda, situacao: '' }))} />
            <FilterSelect overlayInDialog label="Como isso afeta seu uso?" emptyLabel="Selecione o impacto" value={form.impacto} options={impactos}
              onChange={impacto => setForm(atual => ({ ...atual, impacto }))} />
          </div>
          {situacoesDoTipo && <FilterSelect overlayInDialog label="Qual é a situação? (opcional)" emptyLabel="Selecione se quiser" value={form.situacao}
            options={situacoesDoTipo.map(value => ({ value, label: value }))} onChange={situacao => setForm(atual => ({ ...atual, situacao }))} />}
          <Input label="Assunto" placeholder="Resuma o que você precisa" value={form.assunto} required minLength={3} maxLength={120}
            onChange={e => setForm({ ...form, assunto: e.target.value })} />
          <div className="field">
            <label className="field-label" htmlFor={`${id}-descricao`}>{orientacao.pergunta}</label>
            <textarea id={`${id}-descricao`} className="field-input" rows={3} required minLength={10} maxLength={4000}
              placeholder={orientacao.exemplo} aria-describedby={`${id}-privacidade`} value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })} />
          </div>
          {form.tipo === 'ERRO' && <details className="support-extra">
            <summary>Adicionar passos para reproduzir</summary>
            <div className="field">
              <label className="field-label" htmlFor={`${id}-passos`}>Passos (opcional)</label>
              <textarea id={`${id}-passos`} className="field-input" rows={2} maxLength={1200} placeholder="Ex. Abrir Partidas, escolher SUB-7 e tocar em Ver detalhes."
                aria-describedby={`${id}-privacidade`} value={form.passos} onChange={e => setForm({ ...form, passos: e.target.value })} />
            </div>
          </details>}
        </fieldset>
      </form>
      <div className="support-context"><Icon name="location" size={17} /><span title={pagina}>Página incluída · {paginaNome}{!semClube && clubeSelecionado?.nome ? ` · ${clubeSelecionado.nome}` : ''}</span><button type="button" aria-label="Copiar endereço da página" data-tooltip="Copiar endereço" onClick={() => void copiarPagina()}><Icon name="copy" size={17} /></button></div>
      <p id={`${id}-privacidade`} className="support-privacy"><Icon name="defense" size={16} />Não envie senhas, documentos ou códigos de acesso.</p>
    </> : enviado && detalhe ? <section className="support-confirmation">
      <Icon name="checkAll" size={28} />
      <h3>Chamado enviado</h3>
      <p>Acompanhe as respostas da equipe em Meus chamados.</p>
      <small>Protocolo {detalhe.id}</small>
      <Btn onClick={() => setEnviado(false)}>Acompanhar chamado<Icon name="arrow" size={16} /></Btn>
    </section> : <>
      <div className="support-history-heading">{detalheId ? <button type="button" className="support-back" disabled={busy} onClick={voltarALista}><Icon name="chevronLeft" size={16} />Meus chamados</button> : <><strong>Seus chamados</strong><button type="button" className="support-back" disabled={loading} onClick={() => { setLoading(true); setReload(value => value + 1); }}><Icon name="refresh" size={16} />Atualizar</button></>}</div>
      {loading && <div className="support-loading" role="status"><Spinner /><span>Carregando atendimento…</span></div>}
      {!loading && !detalheId && !lista.length && !erroConsulta && <div className="support-empty"><Icon name="headset" size={32} /><strong>Nenhum chamado por aqui</strong><p>Quando precisar de ajuda, abra um chamado.</p><Btn variant="ghost" onClick={() => trocarAba('novo')}>Criar chamado</Btn></div>}
      {!detalheId && lista.length > 0 && <div className="support-tickets" aria-label="Seus chamados">{lista.map(chamado => <button type="button" key={chamado.id} disabled={loading} onClick={() => consultar(chamado)}>
        <Icon name="headset" size={20} /><span>
          <strong>{chamado.assunto}</strong>
          {pendentes[chamado.id] > 0 && <small className="support-unread-label">Nova resposta</small>}
          {chamado.ultimaResposta ? <><span className="support-latest-reply">{chamado.ultimaResposta.motivo}</span><small>Resposta da equipe · {data(chamado.ultimaResposta.criadoEm)}</small></> : <small>Aberto em {data(chamado.criadoEm)}</small>}
          <span className="support-status" data-state={chamado.status}>{SUPPORT_STATUS[chamado.status] || chamado.status}</span>
        </span><Icon name="chevronRight" size={16} />
      </button>)}</div>}
      {chamadoAtual && <section className="support-detail">
        {novaResposta > 0 && <p key={novaResposta} className="support-new-reply" role="status"><Icon name="bell" size={16} />Nova resposta da equipe Ludora.</p>}
        <header><span className="support-status" data-state={chamadoAtual.status}>{SUPPORT_STATUS[chamadoAtual.status] || chamadoAtual.status}</span><h3>{chamadoAtual.assunto}</h3><small>Protocolo {chamadoAtual.id}</small></header>
        {chamadoAtual.descricao && <div className="support-report"><strong>Seu relato</strong><p>{chamadoAtual.descricao}</p></div>}
        {chamadoAtual.historico && chamadoAtual.historico.length > 0 && <ol className="support-timeline">{chamadoAtual.historico.map((item, index) => <li key={item.id ?? index}><strong>{titulosHistorico[item.acao || ''] || 'Atualização do atendimento'}</strong><p>{item.motivo}</p><time dateTime={item.criadoEm}>{data(item.criadoEm)}</time></li>)}</ol>}
        <form onSubmit={responder} className="support-form"><div className="field"><label className="field-label" htmlFor={`${id}-resposta`}>Responder ao atendimento</label><textarea className="field-input" id={`${id}-resposta`} rows={3} required minLength={5} maxLength={4000} disabled={busy} value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Acrescente informações ou responda à equipe." /></div><Btn type="submit" disabled={busy || resposta.trim().length < 5}>{busy ? 'Enviando…' : chamadoAtual.status === 'RESOLVIDO' ? 'Reabrir com resposta' : 'Enviar resposta'}</Btn></form>
      </section>}
    </>}
  </Modal>;
}
