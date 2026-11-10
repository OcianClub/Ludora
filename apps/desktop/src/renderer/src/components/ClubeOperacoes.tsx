import { useEffect, useState } from 'react';
import type { EntradaLog } from '@ludora/shared-types';
import { Btn, DesktopState, LoadingSkeleton } from './AdminUI';
import { requestJson } from '../services/api';
import { DesktopTable } from './DesktopTable';
export { ClubeConvites } from './ClubeConvites';

export function ClubeAtividade({ clubeId }: { clubeId: number }) {
  const [registros, setRegistros] = useState<EntradaLog[] | null>(null);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0);
  const [atualizando, setAtualizando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setErro(''); setAtualizando(true);
    requestJson<EntradaLog[]>(`/admin/clubes/${clubeId}/atividade`).then(
      dados => { if (ativo) setRegistros(dados); },
      erro => { if (ativo) setErro(erro.message); },
    ).finally(()=>{if(ativo)setAtualizando(false);});
    return () => { ativo = false; };
  }, [clubeId, revisao]);

  return <section className="club-access-section">
    <div className="bloco-topo">
      <h2 className="section-title">Atividade administrativa</h2>
      <Btn size="sm" variant="ghost" disabled={atualizando} onClick={() => { setErro(''); setRevisao(valor => valor + 1); }}>{atualizando?'Atualizando…':'Atualizar'}</Btn>
    </div>
    <p className="dica">Alterações feitas no painel de administração durante a execução atual da API.</p>
    {erro && <div className="notice-error" role="alert">{erro}</div>}
    {!registros ? !erro && <LoadingSkeleton kind="table" label="Carregando atividades"/> : registros.length === 0 ? <DesktopState plain icon="clipboard" title="Nenhuma alteração recente" description="As ações administrativas deste clube aparecerão aqui."/> :
      <DesktopTable label="Atividade administrativa">
        <thead><tr><th scope="col">Ação</th><th scope="col">Operador</th><th scope="col">Data e hora</th></tr></thead>
        <tbody>{registros.map(item => <tr key={item.id}>
          <td>{item.mensagem}</td><td>{item.usuarioId ? `#${item.usuarioId}` : 'Sistema'}</td><td>{new Date(item.ts).toLocaleString('pt-BR')}</td>
        </tr>)}</tbody>
      </DesktopTable>}
  </section>;
}
