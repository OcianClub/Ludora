import { useEffect, useRef, useState } from 'react';
import { agoraPartida } from '../../../../packages/shared-types/src/matchSchedule';
import { fetchAgendaWeb, invalidateApiReads, type GrupoAgendaWeb, type PartidaAgendaWeb } from '../services/api';
import { PUBLIC_MATCHES_CHANGED, subscribeClubMatches } from '../services/matchRealtime';

const chaveLinha = (p: PartidaAgendaWeb) => `${p.grupo_agenda}:${p.categoria?.nome.trim().toUpperCase() ?? ''}`;
const mensagem = 'Não foi possível buscar as partidas agora. Confira sua conexão e tente novamente.';

export function useWebAgenda(clubeId: number | undefined, token: string | null, modo: string, filtros?: string) {
  const escopo = filtros === undefined ? undefined : JSON.stringify([clubeId, token, modo, filtros]);
  const [dados, setDados] = useState<{ escopo: string; linhas: PartidaAgendaWeb[] }>();
  const [falha, setFalha] = useState<{ escopo: string; mensagem: string }>();
  const [carregandoMais, setCarregandoMais] = useState(false);
  const controle = useRef<{ carregar: () => Promise<void>; mais: (grupo: GrupoAgendaWeb, categoria: string, apos: number) => void }>();
  const dadosAtuais = useRef(dados);
  dadosAtuais.current = dados;

  useEffect(() => {
    if (!escopo || !clubeId) return;
    const controller = new AbortController();
    let timer: number | undefined;
    let emCurso: Promise<void> | undefined;
    let repetir = false;
    let paginaEmCurso = false;
    let geracao = 0;
    const params = () => {
      const query = new URLSearchParams(filtros);
      query.set('agora', agoraPartida());
      return query;
    };
    const consultar = async () => {
      try {
        const linhas = await fetchAgendaWeb(params(), controller.signal);
        if (controller.signal.aborted) return;
        geracao++;
        setDados(anterior => {
          if (anterior?.escopo !== escopo) return { escopo, linhas };
          const candidatas = new Map<string, PartidaAgendaWeb[]>();
          for (const linha of linhas) {
            const chave = chaveLinha(linha);
            const grupo = candidatas.get(chave) ?? [];
            grupo.push(linha);
            candidatas.set(chave, grupo);
          }
          const primeiras = new Map(linhas.map(linha => [`${chaveLinha(linha)}:${linha.posicao}`, linha]));
          const gruposAlterados = new Set(anterior.linhas.filter(linha => {
            const atual = primeiras.get(`${chaveLinha(linha)}:${linha.posicao}`);
            return atual && (atual.id !== linha.id || atual.total_grupo !== linha.total_grupo || atual.revisao_grupo !== linha.revisao_grupo);
          }).map(chaveLinha));
          const extras = anterior.linhas.filter(linha => {
            const chave = chaveLinha(linha);
            return !gruposAlterados.has(chave) && candidatas.has(chave)
              && linha.posicao > candidatas.get(chave)!.length;
          });
          return { escopo, linhas: [...linhas, ...extras] };
        });
        setFalha(undefined);
      } catch (erro) {
        if (!controller.signal.aborted) setFalha({ escopo, mensagem: erro instanceof Error ? erro.message : mensagem });
      }
    };
    const carregar = (forcar = true) => {
      if (forcar) invalidateApiReads('/partidas/agenda');
      if (emCurso) { repetir ||= forcar; return emCurso; }
      emCurso = (async () => {
        do { repetir = false; await consultar(); } while (repetir && !controller.signal.aborted);
      })().finally(() => { emCurso = undefined; });
      return emCurso;
    };
    const mais = async (grupo: GrupoAgendaWeb, categoria: string, apos: number) => {
      if (paginaEmCurso || controller.signal.aborted || dadosAtuais.current?.escopo !== escopo) return;
      paginaEmCurso = true;
      const pedido = geracao;
      setCarregandoMais(true);
      const query = params();
      query.set('grupo', grupo);
      query.set('categoria_nome', categoria);
      query.set('apos', String(apos));
      try {
        const linhas = await fetchAgendaWeb(query, controller.signal);
        if (controller.signal.aborted || pedido !== geracao) return;
        setDados(anterior => {
          if (!anterior || anterior.escopo !== escopo) return anterior;
          const ids = new Set(anterior.linhas.map(p => `${chaveLinha(p)}:${p.id}`));
          return { escopo, linhas: [...anterior.linhas, ...linhas.filter(p => !ids.has(`${chaveLinha(p)}:${p.id}`))] };
        });
        setFalha(undefined);
      } catch (erro) {
        if (!controller.signal.aborted) setFalha({ escopo, mensagem: erro instanceof Error ? erro.message : mensagem });
      } finally {
        paginaEmCurso = false;
        if (!controller.signal.aborted) setCarregandoMais(false);
      }
    };
    controle.current = { carregar, mais };
    setCarregandoMais(false);
    const refresh = () => {
      if (document.hidden || timer !== undefined) return;
      timer = window.setTimeout(() => { timer = undefined; void carregar(); }, 180);
    };
    const primeiraConsulta = window.setTimeout(() => void carregar(false), 180);
    const unsubscribe = token && modo === 'gestao' ? subscribeClubMatches(clubeId, token, refresh) : undefined;
    for (const evento of [PUBLIC_MATCHES_CHANGED, 'focus', 'online']) window.addEventListener(evento, refresh);
    document.addEventListener('visibilitychange', refresh);
    const poll = window.setInterval(refresh, 30_000);
    return () => {
      controller.abort();
      unsubscribe?.();
      clearInterval(poll);
      clearTimeout(timer);
      clearTimeout(primeiraConsulta);
      for (const evento of [PUBLIC_MATCHES_CHANGED, 'focus', 'online']) window.removeEventListener(evento, refresh);
      document.removeEventListener('visibilitychange', refresh);
      controle.current = undefined;
    };
  }, [clubeId, token, modo, filtros, escopo]);

  const atuais = dados?.escopo === escopo ? dados : undefined;
  const erro = falha?.escopo === escopo ? falha?.mensagem : undefined;
  return {
    linhas: atuais?.linhas ?? [],
    carregando: !!escopo && !atuais && !erro,
    erro: !atuais ? erro : undefined,
    aviso: atuais ? erro : undefined,
    carregandoMais,
    recarregar: () => controle.current?.carregar(),
    carregarMais: (grupo: GrupoAgendaWeb, categoria: string, apos: number) => controle.current?.mais(grupo, categoria, apos),
  };
}
