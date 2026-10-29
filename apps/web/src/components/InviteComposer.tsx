import { useEffect, useRef, useState } from 'react';
import { Modal, Btn, Input } from './UI';
import { Icon, type IconName } from './Icon';
import { requestJson, type Categoria } from '../services/api';
import './InviteComposer.css';

type InviteRole = 'ADMIN' | 'TECNICO' | 'OLHEIRO';
type CreatedInvite = {
  convite: { id: string; email: string; expira_em: string };
  email_enviado: boolean;
  aviso?: string;
  codigo?: string;
};
const roles: { value: InviteRole; title: string; description: string; icon: IconName }[] = [
  { value: 'ADMIN', title: 'Administrador', description: 'Gerencia todo o clube, pessoas e acessos.', icon: 'shield' },
  { value: 'TECNICO', title: 'Técnico', description: 'Gerencia jogadores e partidas nas categorias escolhidas.', icon: 'table' },
  { value: 'OLHEIRO', title: 'Olheiro', description: 'Consulta o conteúdo público, sem acesso de gestão.', icon: 'eye' },
];

export function InviteComposer({ open, onClose, onCreated, onViewInvites, categories, clubName }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onViewInvites: () => void;
  categories: Categoria[];
  clubName: string;
}) {
  const [delivery, setDelivery] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('TECNICO');
  const [ids, setIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [copyFallback, setCopyFallback] = useState(false);
  const [result, setResult] = useState<CreatedInvite | null>(null);
  const sorted = [...categories].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  const selected = sorted.filter(category => ids.includes(category.id));
  const link = result?.codigo ? `${window.location.origin}/convite/${encodeURIComponent(result.codigo)}?entrar=1` : '';
  function reset() {
    setDelivery('email'); setEmail(''); setRole('TECNICO'); setIds([]);
    setError(''); setCopied(''); setCopyFallback(false); setResult(null);
  }
  useEffect(() => { if (open) reset(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const target = result
      ? document.getElementById('invite-success-code')
      : document.querySelector<HTMLInputElement>('#invite-composer-form input[name="invite-method"]');
    target?.closest('dialog')?.querySelector('.modal-body')?.scrollTo({ top: 0 });
    target?.focus({ preventScroll: true });
  }, [open, result]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const address = email.trim().toLowerCase();
    if ((delivery === 'email' || address) && !/^\S+@\S+\.\S+$/.test(address)) {
      setError('Informe um e-mail válido. No modo código, você também pode deixá-lo em branco.'); return;
    }
    if (role === 'TECNICO' && !ids.length) { setError('Escolha ao menos uma categoria para o técnico.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const created = await requestJson<CreatedInvite>('/convites', {
        method: 'POST',
        body: JSON.stringify({ entrega: delivery, email: address, papel: role, acesso_todas_categorias: role === 'ADMIN', categoria_ids: role === 'TECNICO' ? ids : [] }),
      });
      setResult(created); onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível criar o convite. Tente novamente.'); }
    finally { pending.current = false; setBusy(false); }
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopied(`${label} copiado.`); }
    catch { setCopyFallback(true); setCopied('Não foi possível copiar automaticamente. Selecione o código ou o link para copiar.'); }
  }
  const scope = role === 'ADMIN' ? 'Acesso a todas as categorias' : role === 'OLHEIRO' ? 'Conteúdo público' : selected.map(category => category.nome.toUpperCase()).join(', ');
  return <Modal open={open} title={result ? 'Convite criado' : 'Convidar pessoa'} className="members-modal invite-composer" onClose={() => { if (!busy) onClose(); }}
    footer={result ? <><Btn className="invite-create-another" variant="ghost" onClick={reset}>Gerar outro</Btn><Btn onClick={onClose}>Concluir</Btn></> : <><Btn variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Btn><Btn type="submit" form="invite-composer-form" disabled={busy}>{busy ? 'Criando…' : delivery === 'email' ? 'Enviar convite' : 'Gerar código'}</Btn></>}>
    {result ? <div className="invite-success">
      <p className="invite-intro">{delivery === 'email' && result.email_enviado ? `Convite enviado para ${result.convite.email}. Você também pode compartilhar o código ou o link abaixo.` : delivery === 'email' ? result.aviso || 'O convite foi criado, mas o e-mail não pôde ser enviado. Compartilhe o código ou o link abaixo.' : 'Compartilhe o código ou o link. A pessoa pode informar o código na opção de entrar com convite.'}</p>
      {result.codigo ? <section className="invite-share" aria-label="Compartilhar convite">
        <div className="invite-code-panel"><label htmlFor="invite-success-code">Código de uso único</label>
          <input id="invite-success-code" className="invite-success-code" readOnly value={result.codigo} onFocus={event => event.target.select()}/>
        </div>
        <div className="invite-copy-actions"><Btn onClick={() => void copy(result.codigo!, 'Código')}>Copiar código</Btn><Btn variant="ghost" onClick={() => void copy(link, 'Link')}>Copiar link</Btn></div>
        {copyFallback && <Input label="Link do convite" readOnly value={link} onFocus={event => event.target.select()}/>}
        <p className="invite-copy-status" role="status" aria-live="polite">{copied}</p>
      </section> : <p className="members-hint"><Icon name="info" size={18}/>O código não está disponível. Consulte o convite na aba Convites.</p>}
      <dl className="invite-summary">
        <div><dt>Clube</dt><dd>{clubName}</dd></div>
        <div><dt>Cargo</dt><dd>{roles.find(item => item.value === role)?.title}</dd></div>
        <div><dt>Acesso</dt><dd>{scope}</dd></div>
        <div><dt>Destinatário</dt><dd>{result.convite.email || 'Quem usar o código primeiro'}</dd></div>
        <div><dt>Validade</dt><dd>72 horas · uso único<small>Até {new Date(result.convite.expira_em).toLocaleString('pt-BR')}</small></dd></div>
      </dl>
      <button type="button" className="invite-view-pending" onClick={onViewInvites}>Acompanhe e cancele em <strong>Convites pendentes</strong><Icon name="chevronRight" size={16}/></button>
    </div> : <form id="invite-composer-form" onSubmit={event => void create(event)} noValidate>
      <fieldset className="invite-form-fields" disabled={busy}>
        <fieldset className="invite-method"><legend>Como deseja convidar?</legend><div className="invite-method-options">
          {([{ value: 'email', title: 'Enviar por e-mail' }, { value: 'codigo', title: 'Gerar código' }] as const).map(item => <label key={item.value}>
            <input type="radio" name="invite-method" checked={delivery === item.value} onChange={() => { setDelivery(item.value); setError(''); }}/>
            {item.value === 'email' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg> : <span aria-hidden="true" className="invite-method-code">#</span>}
            <span>{item.title}</span>
          </label>)}
        </div></fieldset>
        <div className="invite-email"><Input label={delivery === 'email' ? 'E-mail da pessoa' : 'Restringir a um e-mail (opcional)'} type="email" placeholder={delivery === 'email' ? 'nome@exemplo.com' : 'Deixe em branco para não restringir'} value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" aria-describedby="invite-email-hint"/>
          <p id="invite-email-hint" className="invite-intro">{delivery === 'email' ? 'Somente este e-mail poderá aceitar o convite.' : email.trim() ? 'Somente o e-mail informado poderá usar este código.' : 'Sem e-mail: quem usar primeiro recebe o cargo. Uso único, válido por 72 horas.'}</p>
        </div>
        <fieldset className="invite-role-options"><legend>Cargo no clube</legend>{roles.map(item => <label key={item.value}><input type="radio" name="invite-role" checked={role === item.value} onChange={() => { setRole(item.value); setError(''); }}/><Icon name={item.icon} size={19}/><span><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</fieldset>
        {role === 'TECNICO' ? <fieldset className="invite-categories"><legend>Categorias do técnico <span>· escolha ao menos uma</span></legend>{[{ type: 'INICIACAO', label: 'Iniciação' }, { type: 'BASE', label: 'Base' }].map(group => <div className="invite-category-group" key={group.type}><h3>{group.label}</h3><div>{sorted.filter(category => category.tipo === group.type).map(category => <button key={category.id} type="button" aria-pressed={ids.includes(category.id)} onClick={() => setIds(current => current.includes(category.id) ? current.filter(id => id !== category.id) : [...current, category.id])}>{category.nome.toUpperCase()}{ids.includes(category.id) && <Icon name="checkAll" size={14}/>}</button>)}</div></div>)}{!categories.length && <p className="invite-intro">Nenhuma categoria disponível. Cadastre as categorias antes de convidar um técnico.</p>}</fieldset>
          : <p className="invite-scope"><Icon name={role === 'ADMIN' ? 'shield' : 'eye'} size={19}/><span>{scope}</span></p>}
        <p className="members-hint"><Icon name="info" size={18}/>{role === 'ADMIN' ? 'Administrador pode gerenciar todo o clube e os acessos. ' : ''}{delivery === 'codigo' && !email.trim() ? 'Compartilhe apenas com a pessoa que deve receber este cargo. O código deixa de funcionar após o primeiro aceite ou em 72 horas.' : 'Convite individual, de uso único e válido por 72 horas.'}</p>
        {error && <p className="members-form-error" role="alert">{error}</p>}
      </fieldset>
    </form>}
  </Modal>;
}
