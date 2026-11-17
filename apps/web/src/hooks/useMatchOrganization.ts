import { useEffect, useState } from 'react';
import { requestJson } from '../services/api';
import { horarioPassado } from '../../../../packages/shared-types/src/matchSchedule';
import type { ContextoOrganizacao, ConflitoOrganizacao } from '../../../../packages/shared-types/src/matchOrganization';

export function useMatchOrganization(open: boolean, clubeId: number | undefined, categoriaId: string, confronto: { mandante_id: string; visitante_id: string; data: string; horario: string }) {
  const scope = `${clubeId}:${categoriaId}`;
  const [contexto, setContexto] = useState<{ scope: string; dados: ContextoOrganizacao }>();
  const [previa, setPrevia] = useState<{ key: string; dados?: ConflitoOrganizacao; erro?: boolean }>();
  useEffect(() => {
    if (!open || !clubeId || !categoriaId) return;
    const controller = new AbortController();
    void requestJson<ContextoOrganizacao>(`/partidas/organizacao/contexto?categoria_id=${categoriaId}`, { signal: controller.signal }).then(dados => {
      if (!controller.signal.aborted && Array.isArray(dados.recentes)) setContexto({ scope, dados });
    }).catch(() => {});
    return () => controller.abort();
  }, [open, scope, clubeId, categoriaId]);
  const valido = open && !!clubeId && !!categoriaId && !!confronto.mandante_id && !!confronto.visitante_id && /^\d{4}-\d{2}-\d{2}$/.test(confronto.data) && /^([01]\d|2[0-3]):[0-5]\d$/.test(confronto.horario) && !horarioPassado(confronto.data,confronto.horario);
  const query = new URLSearchParams({ categoria_id: categoriaId, ...confronto }).toString();
  const key = `${scope}:${query}`;
  useEffect(() => {
    if (!valido) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void requestJson<ConflitoOrganizacao>(`/partidas/organizacao/conflitos?${query}`, { signal: controller.signal, cache: 'no-store' }).then(dados => {
        if (typeof dados?.conflito !== 'boolean') throw new Error('Resposta de agenda inválida');
        if (!controller.signal.aborted) setPrevia({ key, dados });
      }).catch(() => { if (!controller.signal.aborted) setPrevia({ key, erro: true }); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [valido, key, query]);
  const atual = valido && previa?.key === key ? previa : undefined;
  return { contexto: contexto?.scope === scope ? contexto.dados : undefined, conflito: atual?.dados, erro: !!atual?.erro, verificando: valido && !atual };
}
