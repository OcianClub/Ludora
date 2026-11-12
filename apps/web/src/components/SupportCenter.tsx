import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { SupportContext, type SuporteAviso } from '../contexts/SupportContext';
import { BASE_URL, requestJson } from '../services/api';
import { SupportDialog } from './SupportButton';
import { Toast } from './Toast';

type AvisosPorChamado = Record<string, number>;

function lerVistos(chave: string): AvisosPorChamado {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(chave) || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).filter(([, id]) => Number.isSafeInteger(id) && id > 0));
    }
  } catch { /* O histórico continua disponível sem armazenamento local. */ }
  return {};
}

export function SupportCenter({ children }: { children: ReactNode }) {
  const { token, usuario } = useAuth();
  if (!token || !usuario?.id) return <>{children}</>;
  return <SuporteAutenticado key={usuario.id} usuarioId={usuario.id} token={token}>{children}</SuporteAutenticado>;
}

function SuporteAutenticado({ usuarioId, token, children }: { usuarioId: number; token: string; children: ReactNode }) {
  const { clubeSelecionado, modo } = useAuth();
  const escopo = modo + ':' + (clubeSelecionado?.id ?? '');
  const chave = 'ludora_suporte_vistos:' + BASE_URL + ':' + usuarioId;
  const [vistos, setVistos] = useState(() => lerVistos(chave));
  const [avisos, setAvisos] = useState<AvisosPorChamado>({});
  const [destino, setDestino] = useState<{ escopo: string; chamadoId?: string; historico: boolean } | null>(null);
  const [descartado, setDescartado] = useState(0);
  useEffect(() => { setDestino(null); }, [escopo]);

  const marcarVisto = useCallback((chamadoId: string, respostaId: number) => {
    if (!respostaId || document.hidden) return;
    setVistos(anterior => {
      if ((anterior[chamadoId] || 0) >= respostaId) return anterior;
      return { ...anterior, [chamadoId]: respostaId };
    });
  }, []);

  useEffect(() => {
    const armazenados = lerVistos(chave);
    for (const [chamadoId, id] of Object.entries(vistos)) {
      armazenados[chamadoId] = Math.max(armazenados[chamadoId] || 0, id);
    }
    const salvo = JSON.stringify(armazenados);
    try { if (localStorage.getItem(chave) !== salvo) localStorage.setItem(chave, salvo); } catch { /* Uso em memória. */ }
  }, [chave, vistos]);

  useEffect(() => {
    function sincronizarVistos(event: StorageEvent) {
      if (event.key === chave) setVistos(lerVistos(chave));
    }
    window.addEventListener('storage', sincronizarVistos);
    return () => window.removeEventListener('storage', sincronizarVistos);
  }, [chave]);

  useEffect(() => {
    const controller = new AbortController();
    let consultando = false;

    function receber(novos: SuporteAviso[]) {
      if (controller.signal.aborted) return;
      setAvisos(anteriores => {
        const atualizados = { ...anteriores };
        let mudou = false;
        for (const { id, chamadoId } of novos) {
          if (id <= (atualizados[chamadoId] || 0)) continue;
          atualizados[chamadoId] = id;
          mudou = true;
        }
        return mudou ? atualizados : anteriores;
      });
    }

    async function atualizar() {
      if (consultando || document.hidden) return;
      consultando = true;
      try {
        const novos = await requestJson<SuporteAviso[]>('/suporte/avisos', {
          semClube: true, cache: 'no-store', signal: controller.signal,
        });
        if (Array.isArray(novos)) receber(novos);
      } catch { /* A conexão em tempo real e a próxima consulta retomam os avisos. */ }
      finally { consultando = false; }
    }

    const socket = io(BASE_URL + '/suporte', { auth: { token } });
    socket.on('resposta_suporte', aviso => receber([aviso]));
    socket.on('connect', atualizar);
    void atualizar();
    const timer = window.setInterval(atualizar, 30_000);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      controller.abort();
      socket.disconnect();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [token]);

  const pendentes = useMemo(() => Object.entries(avisos)
    .filter(([chamadoId, id]) => id > (vistos[chamadoId] || 0))
    .sort(([, a], [, b]) => b - a), [avisos, vistos]);
  const aviso = pendentes[0];
  const temPendencias = pendentes.length > 0;
  const abrirSuporte = useCallback((chamadoId?: string) => setDestino({ escopo, chamadoId, historico: temPendencias }), [escopo, temPendencias]);
  const aberto = destino?.escopo === escopo;
  const contexto = useMemo(() => ({
    abrirSuporte, marcarVisto, naoLidos: pendentes.length,
    avisos, pendentes: Object.fromEntries(pendentes),
  }), [abrirSuporte, marcarVisto, avisos, pendentes]);

  return <SupportContext.Provider value={contexto}>
    {children}
    <SupportDialog key={escopo} open={aberto} chamadoInicial={destino?.chamadoId}
      iniciarNoHistorico={destino?.historico} onClose={() => setDestino(null)} />
    {!aberto && aviso && aviso[1] > descartado && <Toast key={aviso[1]}
      message={pendentes.length > 1 ? 'Você tem novas respostas do Suporte Ludora.' : 'O Suporte Ludora respondeu ao seu chamado.'}
      onClose={() => setDescartado(aviso[1])}
      action={{ label: 'Ver resposta', onClick: () => abrirSuporte(aviso[0]) }} />}
  </SupportContext.Provider>;
}
