import { io } from 'socket.io-client';
import { BASE_URL } from '../services/config';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { requestJson } from '../services/api';
import { Btn, Modal } from './UI';
import { Icon } from './Icon';
import { NotificationItem } from './NotificationItem';
import { FilterSelect } from './FilterSelect';
import { groupNotices, NOTICE_LABELS, type Notice, type NoticeType } from '../utils/notifications';
import './Notifications.css';

type NoticeResponse = { notificacoes: Notice[]; totalNaoLidas: number; proximoCursor?: number | null };
const emptyData: NoticeResponse = { notificacoes: [], totalNaoLidas: 0, proximoCursor: null };

export function Notifications() {
  const { clube, token } = useAuth();
  const navigate = useNavigate();
  const { key: navigationKey } = useLocation();
  const dialogId = useId();
  const currentClub = useRef(clube?.id);
  currentClub.current = clube?.id;
  const scope = useRef(0);
  const revision = useRef(0);
  const busyRef = useRef(false);
  const loadedMore = useRef(false);
  const reload = useRef<(append?: boolean) => Promise<void>>(async () => {});
  const dataRef = useRef<NoticeResponse>(emptyData);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<NoticeResponse>(emptyData);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [type, setType] = useState<NoticeType | ''>('');
  const [confirmation, setConfirmation] = useState<'all' | 'read' | null>(null);
  const [message, setMessage] = useState('');

  function updateData(update: (previous: NoticeResponse) => NoticeResponse) {
    const value = update(dataRef.current);
    dataRef.current = value;
    setData(value);
  }

  useEffect(() => {
    let active = true;
    let pending = false;
    let refreshQueued = false;
    const currentScope = ++scope.current;
    busyRef.current = false;
    loadedMore.current = false;
    updateData(() => emptyData);
    setError('');
    setMessage('');
    setOpen(false);
    setBusy(false);
    setFetching(false);
    setFilter('all');
    setType('');
    setConfirmation(null);
    setLoading(Boolean(clube?.meuPapel));

    async function refresh(append = false) {
      if (!active || !clube?.meuPapel || busyRef.current) return;
      if (pending) { refreshQueued = true; return; }
      const cursor = append ? dataRef.current.proximoCursor : null;
      if (append && !cursor) return;
      pending = true;
      setFetching(true);
      const requestRevision = revision.current;
      try {
        const value = await requestJson<NoticeResponse>(`/notificacoes?limite=50${cursor ? `&cursor=${cursor}` : ''}`);
        if (!active || scope.current !== currentScope || requestRevision !== revision.current) return;
        updateData(previous => {
          const merge = append || loadedMore.current;
          const rows = merge ? [...new Map(
            [...previous.notificacoes, ...value.notificacoes]
              .map(item => [item.id, item]),
          ).values()].sort((a, b) => Date.parse(b.criada_em) - Date.parse(a.criada_em) || b.id - a.id) : value.notificacoes;
          return {
            notificacoes: rows, totalNaoLidas: value.totalNaoLidas,
            proximoCursor: append || !loadedMore.current ? value.proximoCursor ?? null : previous.proximoCursor,
          };
        });
        if (append) loadedMore.current = true;
        setError('');
      } catch {
        if (active && requestRevision === revision.current) setError('Não foi possível carregar os avisos. Verifique sua conexão e tente novamente.');
      } finally {
        pending = false;
        if (active) {
          setLoading(false); setFetching(false);
          if (refreshQueued) { refreshQueued = false; void refresh(); }
        }
      }
    }

    reload.current = refresh;
    void refresh();
    const socket = token && clube?.meuPapel ? io(BASE_URL, { auth: { token, clubeId: clube.id } }) : null;
    socket?.on('notificacao_criada', () => { void refresh(); });
    socket?.on('connect', () => { void refresh(); });
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
    return () => {
      active = false;
      if (scope.current === currentScope) scope.current++;
      window.clearInterval(timer);
      socket?.disconnect();
    };
  }, [clube?.id, clube?.meuPapel, token]);

  useEffect(() => {
    setOpen(false);
    setConfirmation(null);
  }, [navigationKey]);

  async function mutate(endpoint: string, method: 'PATCH' | 'DELETE', apply: () => void, feedback: string) {
    if (busyRef.current) return false;
    const clubId = clube?.id;
    const currentScope = scope.current;
    busyRef.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await requestJson(endpoint, { method });
      if (currentClub.current !== clubId || scope.current !== currentScope) return false;
      apply();
      setMessage(feedback);
      return true;
    } catch {
      if (currentClub.current === clubId && scope.current === currentScope) setError('Não foi possível confirmar a alteração. Atualize os avisos e tente novamente.');
      return false;
    } finally {
      if (currentClub.current === clubId && scope.current === currentScope) {
        revision.current++;
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  async function read(notice?: Notice) {
    const target = notice?.dados?.solicitacaoId ? `/partidas/solicitacoes?id=${encodeURIComponent(notice.dados.solicitacaoId)}` : notice?.partida_id ? `/partidas/${notice.partida_id}` : null;
    if (notice?.lida) {
      if (target) { setOpen(false); navigate(target); }
      return;
    }
    const ok = await mutate(notice ? `/notificacoes/${notice.id}/lida` : '/notificacoes/lidas', 'PATCH', () => {
      updateData(previous => ({
        ...previous,
        notificacoes: previous.notificacoes.map(item => !notice || item.id === notice.id ? { ...item, lida: true } : item),
        totalNaoLidas: notice ? Math.max(0, previous.totalNaoLidas - (previous.notificacoes.find(item => item.id === notice.id)?.lida ? 0 : 1)) : 0,
      }));
    }, notice ? 'Aviso marcado como lido.' : 'Todos os avisos foram marcados como lidos.');
    if (ok && target) { setOpen(false); navigate(target); }
  }

  async function remove(kind: 'all' | 'read' | Notice) {
    const single = typeof kind === 'object' ? kind : null;
    const endpoint = single ? `/notificacoes/${single.id}` : kind === 'read' ? '/notificacoes/lidas' : '/notificacoes';
    const ok = await mutate(endpoint, 'DELETE', () => {
      if (kind === 'all') loadedMore.current = false;
      updateData(previous => {
        const rows = previous.notificacoes.filter(item => single ? item.id !== single.id : kind === 'read' && !item.lida);
        const removedUnread = single && previous.notificacoes.some(item => item.id === single.id && !item.lida) ? 1 : 0;
        return {
          notificacoes: rows,
          totalNaoLidas: kind === 'all' ? 0 : Math.max(0, previous.totalNaoLidas - removedUnread),
          proximoCursor: kind === 'all' ? null : previous.proximoCursor ? rows[rows.length - 1]?.id ?? null : null,
        };
      });
      setConfirmation(null);
    }, single ? 'Notificação excluída.' : kind === 'read' ? 'Avisos lidos removidos.' : 'Todos os seus avisos deste clube foram removidos.');
    if (ok && kind !== 'all' && !dataRef.current.notificacoes.length) {
      loadedMore.current = false;
      void reload.current();
    }
  }

  const groups = useMemo(() => groupNotices(data.notificacoes.filter(notice =>
    (filter === 'all' || !notice.lida) && (!type || notice.tipo === type),
  )), [data.notificacoes, filter, type]);
  const readCount = data.notificacoes.filter(notice => notice.lida).length;
  const emptyTitle = data.proximoCursor ? 'Nenhum aviso encontrado nesta página'
    : filter === 'unread' ? 'Nenhum aviso não lido'
    : type ? 'Nenhum aviso deste tipo' : 'Nenhuma notificação por enquanto';
  const emptyDescription = data.proximoCursor ? 'Há mais avisos no histórico. Carregue mais para continuar a busca.'
    : filter === 'unread' ? 'Você está em dia com este filtro.'
    : type ? 'Experimente selecionar todos os tipos.' : 'As novidades do clube aparecerão aqui.';

  return (
    <>
      <button className="profile-link notifications-trigger" type="button"
        aria-label={`Notificações, ${data.totalNaoLidas} não lidas`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId}
        onClick={() => { setOpen(true); void reload.current(); }}>
        <Icon name="bell" size={23} />
        {data.totalNaoLidas > 0 && <span className="notification-dot" aria-hidden="true" />}
      </button>
      <Modal open={open} onClose={() => { setOpen(false); setConfirmation(null); }} title="Notificações"
        id={dialogId} className="notifications-drawer" headerActions={clube?.meuPapel && <details className="notification-menu"
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
          onKeyDown={event => { if (event.key === 'Escape' && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
          <summary aria-label="Ações das notificações">···</summary>
          <div className="notification-menu-options" onClick={event => {
            if ((event.target as HTMLElement).closest('button')) event.currentTarget.closest('details')?.removeAttribute('open');
          }}>
            <button type="button" disabled={busy || loading || !data.totalNaoLidas} onClick={() => void read()}><Icon name="checkAll" size={17} />Marcar todas como lidas</button>
            <button type="button" disabled={busy || loading || (!readCount && !data.proximoCursor)} onClick={() => setConfirmation('read')}><Icon name="checkAll" size={17} />Excluir avisos lidos</button>
            <button type="button" className="notification-menu-danger" disabled={busy || loading || !data.notificacoes.length} onClick={() => setConfirmation('all')}><Icon name="trash" size={17} />Excluir todas as notificações</button>
          </div>
        </details>}>
        <div className="notifications-summary">
          <div><p>{clube?.nome || 'Seu clube'}</p>{!loading && !error && !data.totalNaoLidas && <span>Você está em dia com os avisos do clube.</span>}</div>
        </div>
        {clube?.meuPapel && <>
          <div className="notification-filters">
            <div className="notification-tabs" role="group" aria-label="Filtrar leitura">
              <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todas</button>
              <button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Não lidas {data.totalNaoLidas > 0 && <span aria-hidden="true" className="notification-unread-count">{data.totalNaoLidas}</span>}</button>
            </div>
            <div className="notification-type">
              <FilterSelect label="Tipo de aviso" value={type} emptyLabel="Todos os tipos"
                onChange={value => setType(value as NoticeType | '')}
                options={Object.entries(NOTICE_LABELS).map(([value, label]) => ({ value, label }))}/>
            </div>
          </div>
          {confirmation && <section className="notification-confirm" role="alert" aria-label="Confirmar limpeza">
            <h3>{confirmation === 'all' ? 'Excluir todos os avisos?' : 'Limpar os avisos lidos?'}</h3>
            <p>{confirmation === 'all' ? 'Todos os seus avisos deste clube, incluindo os não lidos, serão excluídos.' : 'Somente os seus avisos já lidos deste clube serão excluídos.'} Essa ação não pode ser desfeita.</p>
            <div><Btn variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</Btn><Btn variant="danger" size="sm" disabled={busy} onClick={() => void remove(confirmation)}>{busy ? 'Excluindo…' : 'Confirmar exclusão'}</Btn></div>
          </section>}
        </>}
        {error && <div role="alert" className="notice-error"><p>{error}</p><button type="button" disabled={busy || fetching} onClick={() => void reload.current()}>Tentar novamente</button></div>}
        <p className="notification-feedback" role="status" aria-live="polite">{busy ? 'Salvando alteração…' : message}</p>
        {loading ? <div className="notifications-empty" role="status">Carregando notificações…</div>
          : !clube?.meuPapel ? <div className="notifications-empty"><Icon name="bell" size={32} /><h3>Acompanhe este clube</h3><p>Siga o clube para receber seus avisos.</p></div>
          : groups.length ? <div className="notification-groups">{groups.map(group => <section key={group.label} className="notification-group" aria-label={group.label}><h3>{group.label}</h3><ul className="notification-list">{group.notices.map(notice => <li key={notice.id}><NotificationItem notice={notice} busy={busy} onRead={() => void read(notice)} onDelete={() => void remove(notice)} /></li>)}</ul></section>)}</div>
          : !error && (
            <div className="notifications-empty">
              <Icon name="bell" size={32} />
              <h3>{emptyTitle}</h3>
              <p>{emptyDescription}</p>
            </div>
          )}
        {data.proximoCursor && <Btn variant="ghost" disabled={busy || fetching} onClick={() => void reload.current(true)}>{fetching ? 'Carregando…' : 'Carregar mais avisos'}</Btn>}
      </Modal>
    </>
  );
}
