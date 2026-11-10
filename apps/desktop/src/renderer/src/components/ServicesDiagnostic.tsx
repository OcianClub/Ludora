import { useEffect, useState } from 'react';
import { Icon } from '@web/components/Icon';
import { Btn, DesktopSection, DesktopState, LoadingSkeleton } from './AdminUI';
import { requestJson } from '../services/api';

type Diagnostico = { banco: string; latenciaMs: number; consultadoEm: string; emailConfigurado: boolean; paulistaHabilitado: boolean };

export function ServicesDiagnostic() {
  const [dados, setDados] = useState<Diagnostico | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro('');
    requestJson<Diagnostico>('/admin/equipe/diagnostico').then(d => { if (ativo) setDados(d); })
      .catch(e => { if (ativo) setErro(e.message); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [revisao]);
  return <DesktopSection className="desktop-services" title="Diagnóstico dos serviços"
    description={dados ? `Última consulta ${new Date(dados.consultadoEm).toLocaleString('pt-BR')}` : undefined}
    actions={<Btn variant="ghost" disabled={carregando} onClick={() => setRevisao(n => n + 1)}><Icon name="refresh" size={16}/>{carregando ? 'Verificando…' : 'Atualizar diagnóstico'}</Btn>}>
    {erro && <DesktopState error title="Não foi possível atualizar o diagnóstico" description={dados ? 'Os últimos dados consultados continuam visíveis.' : erro} onRetry={() => setRevisao(n => n + 1)}/>}
    {!dados && carregando ? <LoadingSkeleton kind="stats" count={3} label="Verificando serviços"/> : dados && <dl className="equipe-diagnostico">
      <div><dt>Banco de dados</dt><dd>{dados.banco === 'disponivel' ? 'Disponível' : dados.banco} · {dados.latenciaMs} ms</dd></div>
      <div><dt>Envio de e-mail</dt><dd>{dados.emailConfigurado ? 'Provedor configurado' : 'Provedor não configurado'}</dd><small>A entrega depende de cada envio.</small></div>
      <div><dt>Integração Paulista</dt><dd>{dados.paulistaHabilitado ? 'Habilitada' : 'Desabilitada neste ambiente'}</dd></div>
    </dl>}
  </DesktopSection>;
}
