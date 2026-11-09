import { useEffect, useState, type FormEvent } from 'react';
import type { EntradaLog } from '@ludora/shared-types';
import { Btn, Card, Input, Modal, PapelBadge, Spinner } from '@web/components/UI';
import { Toast } from '@web/components/Toast';
import { requestJson } from '../services/api';

interface Convite {
  id: string;
  email: string | null;
  papel: string;
  situacao: string;
  expira_em: string;
}

const situacoes: Record<string, string> = {
  PENDENTE: 'Pendente', ACEITO: 'Aceito', EXPIRADO: 'Expirado', REVOGADO: 'Revogado',
};

export function ClubeConvites({ clubeId }: { clubeId: number }) {
  const endpoint = `/admin/clubes/${clubeId}/convites`;
  const [convites, setConvites] = useState<Convite[] | null>(null);
  const [revisao, setRevisao] = useState(0);
  const [email, setEmail] = useState('');
  const [entrega, setEntrega] = useState<'email' | 'codigo'>('email');
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cancelar, setCancelar] = useState<Convite | null>(null);

  useEffect(() => {
    let ativo = true;
    requestJson<{ convites: Convite[] }>(endpoint).then(
      dados => { if (ativo) setConvites(dados.convites); },
      erro => { if (ativo) setErro(erro.message); },
    );
    return () => { ativo = false; };
  }, [endpoint, revisao]);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setErro('');
    setAviso('');
    setCodigo('');
    try {
      const resultado = await requestJson<{ codigo?: string; email_enviado: boolean; aviso?: string }>(endpoint, {
        method: 'POST',
        body: { email, entrega, papel: 'ADMIN' },
      });
      setCodigo(resultado.codigo ?? '');
      setAviso(resultado.aviso || (resultado.email_enviado ? 'Convite enviado por e-mail.' : 'Convite criado.'));
      setEmail('');
      setRevisao(valor => valor + 1);
    } catch (erro) {
      setErro((erro as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function revogar() {
    if (!cancelar || ocupado) return;
    setOcupado(true);
    setErro('');
    try {
      await requestJson(`${endpoint}/${cancelar.id}/revogar`, { method: 'POST' });
      setCancelar(null);
      setCodigo('');
      setAviso('Convite revogado.');
      setRevisao(valor => valor + 1);
    } catch (erro) {
      setCancelar(null);
      setErro((erro as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return <>
    <Card className="bloco">
      <h2 className="section-title">Convidar administrador</h2>
      <p className="dica">O convite dá acesso a todas as categorias deste clube. Vale por 72 horas e pode ser usado uma vez.</p>
      <div className="actions" role="group" aria-label="Forma de entrega">
        <Btn variant={entrega === 'email' ? 'primary' : 'ghost'} aria-pressed={entrega === 'email'} onClick={() => setEntrega('email')}>Por e-mail</Btn>
        <Btn variant={entrega === 'codigo' ? 'primary' : 'ghost'} aria-pressed={entrega === 'codigo'} onClick={() => setEntrega('codigo')}>Gerar código</Btn>
      </div>
      <form className="filter-bar" onSubmit={criar}>
        <Input label={entrega === 'email' ? 'E-mail' : 'E-mail (opcional)'} type="email" required={entrega === 'email'} value={email} onChange={e => setEmail(e.target.value)} />
        <Btn type="submit" disabled={ocupado}>{entrega === 'email' ? 'Enviar convite' : 'Gerar código'}</Btn>
      </form>
      {entrega === 'codigo' && <p className="dica">Sem e-mail, a primeira pessoa que usar o código recebe o acesso.</p>}
      {erro && <div className="notice-error" role="alert">{erro}</div>}
      <Toast message={aviso} onClose={() => setAviso('')}/>
      {codigo && <div className="actions admin-invite-code">
        <code>{codigo}</code>
        <Btn variant="ghost" onClick={() => void navigator.clipboard.writeText(codigo).then(
          () => setAviso('Código copiado.'),
          () => setErro('Não foi possível copiar automaticamente. Selecione e copie o código.'),
        )}>Copiar código</Btn>
      </div>}
    </Card>
    <Card className="bloco">
      <div className="bloco-topo">
        <h2 className="section-title">Convites do clube</h2>
        <Btn size="sm" variant="ghost" onClick={() => { setErro(''); setRevisao(valor => valor + 1); }}>Atualizar</Btn>
      </div>
      {!convites ? !erro && <Spinner /> : convites.length === 0 ? <p className="dica">Nenhum convite registrado.</p> :
        <div className="table-wrap"><table>
          <thead><tr><th>Destinatário</th><th>Cargo</th><th>Situação</th><th>Validade</th><th>Ações</th></tr></thead>
          <tbody>{convites.map(convite => <tr key={convite.id}>
            <td>{convite.email || 'Código sem e-mail'}</td>
            <td><PapelBadge papel={convite.papel} /></td>
            <td>{situacoes[convite.situacao] ?? convite.situacao}</td>
            <td>{new Date(convite.expira_em).toLocaleString('pt-BR')}</td>
            <td>{convite.situacao === 'PENDENTE' && <Btn size="sm" variant="danger" disabled={ocupado} onClick={() => setCancelar(convite)}>Revogar</Btn>}</td>
          </tr>)}</tbody>
        </table></div>}
    </Card>
    <Modal title="Revogar convite?" open={!!cancelar} onClose={() => { if (!ocupado) setCancelar(null); }}>
      <p>O código deixa de funcionar assim que o convite for revogado.</p>
      <div className="actions">
        <Btn variant="ghost" disabled={ocupado} onClick={() => setCancelar(null)}>Voltar</Btn>
        <Btn variant="danger" disabled={ocupado} onClick={() => void revogar()}>Revogar convite</Btn>
      </div>
    </Modal>
  </>;
}

export function ClubeAtividade({ clubeId }: { clubeId: number }) {
  const [registros, setRegistros] = useState<EntradaLog[] | null>(null);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0);

  useEffect(() => {
    let ativo = true;
    requestJson<EntradaLog[]>(`/admin/clubes/${clubeId}/atividade`).then(
      dados => { if (ativo) setRegistros(dados); },
      erro => { if (ativo) setErro(erro.message); },
    );
    return () => { ativo = false; };
  }, [clubeId, revisao]);

  return <Card className="bloco">
    <div className="bloco-topo">
      <h2 className="section-title">Atividade administrativa</h2>
      <Btn size="sm" variant="ghost" onClick={() => { setErro(''); setRevisao(valor => valor + 1); }}>Atualizar</Btn>
    </div>
    <p className="dica">Alterações feitas no painel de administração durante a execução atual da API.</p>
    {erro && <div className="notice-error" role="alert">{erro}</div>}
    {!registros ? !erro && <Spinner /> : registros.length === 0 ? <p className="dica">Nenhuma alteração recente neste clube.</p> :
      <div className="table-wrap"><table>
        <thead><tr><th>Ação</th><th>Operador</th><th>Data e hora</th></tr></thead>
        <tbody>{registros.map(item => <tr key={item.id}>
          <td>{item.mensagem}</td><td>{item.usuarioId ? `#${item.usuarioId}` : 'Sistema'}</td><td>{new Date(item.ts).toLocaleString('pt-BR')}</td>
        </tr>)}</tbody>
      </table></div>}
  </Card>;
}
