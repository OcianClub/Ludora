import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EnderecoCadastro } from '@ludora/shared-types';
import { Btn, Input } from './AdminUI';
import { ClubBadge } from '@web/components/Brand';
import { DesktopSelect } from './DesktopSelect';
import { Icon } from '@web/components/Icon';
import { requestJson } from '../services/api';
import { CLUB_STATES, formatClubCep } from '@web/utils/clubProfile';
import { ClubSettingsSection } from '@web/components/ClubSettingsSection';

export const ENDERECO_VAZIO: EnderecoCadastro = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' };
export const SUBS = [7, 8, 9, 10, 12, 14, 16, 18];
const UFS = CLUB_STATES.map(value => ({ value, label: value }));
export function mascaraCnpj(valor: string) {
  return valor.replace(/\D/g, '').slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2').replace(/(\.\d{3})(\d)/, '$1/$2').replace(/(\/\d{4})(\d)/, '$1-$2');
}
export function enderecoCompleto(endereco: EnderecoCadastro) {
  return /^\d{5}-?\d{3}$/.test(endereco.cep) && [endereco.logradouro, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado].every(v => typeof v === 'string' && v.trim());
}

export function ClubSubChoices({ options, selected, onChange }: {
  options: { id: number; nome: string; tipo: string }[]; selected: number[]; onChange: (id: number) => void;
}) {
  return <div className="club-sub-choices">{(['INICIACAO', 'BASE'] as const).map(tipo => {
    const categorias = options.filter(c => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
    if (!categorias.length) return null;
    return <fieldset className="club-sub-group" key={tipo}><legend>{tipo === 'BASE' ? 'Base' : 'Iniciação'}</legend>
      <div>{categorias.map(c => <button key={c.id} type="button" aria-pressed={selected.includes(c.id)} onClick={() => onChange(c.id)}>{c.nome.toUpperCase()}</button>)}</div>
    </fieldset>;
  })}</div>;
}

export function ClubeResumoCadastro({ nome, cnpj, escudo, endereco, plano, extra }: {
  nome: string; cnpj?: string | null; escudo?: string | null; endereco: EnderecoCadastro; plano: string; extra?: ReactNode;
}) {
  const local = [endereco.cidade, endereco.estado].filter(Boolean).join(' · ');
  const logradouro = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
  return <div className="desktop-club-settings">
    <ClubSettingsSection icon="shield" title="Identidade do clube" description="Dados usados para identificar o clube na plataforma.">
      <div className="club-crest-editor"><ClubBadge name={nome} src={escudo} size={64}/><div><strong>{nome}</strong>{local && <p className="club-settings-hint">{local}</p>}</div></div>
      <dl className="club-settings-facts"><div><dt>CNPJ</dt><dd>{cnpj ? mascaraCnpj(cnpj) : 'Pendente'}</dd></div><div><dt>Plano</dt><dd>{plano}</dd></div>{extra}</dl>
    </ClubSettingsSection>
    <ClubSettingsSection icon="location" title="Sede e endereço" description="Endereço de referência para organizar partidas.">
      {logradouro || local || endereco.cep ? <dl className="club-settings-facts">
        <div className="full"><dt>Endereço</dt><dd>{[logradouro, endereco.bairro, endereco.complemento].filter(Boolean).join(' · ') || 'Pendente'}</dd></div>
        <div><dt>Município</dt><dd>{local || 'Pendente'}</dd></div><div><dt>CEP</dt><dd>{formatClubCep(endereco.cep || '') || 'Pendente'}</dd></div>
      </dl> : <p className="club-settings-hint">A sede ainda precisa ser cadastrada.</p>}
    </ClubSettingsSection>
  </div>;
}

export function EnderecoFields({ value, onChange }: { value: EnderecoCadastro; onChange: (valor: EnderecoCadastro) => void }) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [consultaCep, setConsultaCep] = useState('');
  const atual = useRef(value);
  const atualizar = useRef(onChange);
  atual.current = value;
  atualizar.current = onChange;
  function mudar(campo: keyof EnderecoCadastro, texto: string) { onChange({ ...atual.current, [campo]: texto }); }
  useEffect(() => {
    if (consultaCep.length !== 8) return;
    let ativa = true;
    const anterior = atual.current;
    const aindaAtual = () => ativa && atual.current.cep.replace(/\D/g, '') === consultaCep;
    const timer = window.setTimeout(async () => {
      setBuscando(true);
      try {
        type Campos = Pick<EnderecoCadastro, 'logradouro' | 'bairro' | 'cidade' | 'estado'>;
        const resposta = await requestJson<Campos>(`/admin/cep/${consultaCep}`);
        if (!aindaAtual()) return;
        const preenchido = { ...atual.current };
        for (const campo of ['logradouro', 'bairro', 'cidade', 'estado'] as const) {
          if (resposta[campo] && preenchido[campo] === anterior[campo]) preenchido[campo] = resposta[campo];
        }
        atualizar.current(preenchido);
        setAviso(resposta.logradouro && resposta.bairro ? 'Endereço localizado. Confira os dados e informe o número.' : 'Endereço localizado parcialmente. Complete os dados da sede.');
      } catch (e) { if (aindaAtual()) setAviso((e as Error).message); }
      finally { if (aindaAtual()) setBuscando(false); }
    }, 320);
    return () => { ativa = false; clearTimeout(timer); };
  }, [consultaCep]);
  return <ClubSettingsSection icon="location" title="Sede e endereço" description="Preencha o CEP para buscar o endereço da sede." className="full">
    <fieldset className="club-address-grid">
      <legend className="sr-only">Endereço da sede</legend>
      <Input className="club-address-cep" label="CEP" placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" maxLength={9} value={formatClubCep(value.cep || '')} onChange={e => {
        const cep = e.target.value.replace(/\D/g, '').slice(0, 8);
        if (cep === (value.cep || '').replace(/\D/g, '')) return;
        setAviso(''); setBuscando(false); setConsultaCep(cep); mudar('cep', cep);
      }}/>
      <Input className="club-address-city" label="Cidade" maxLength={160} value={value.cidade} onChange={e => mudar('cidade', e.target.value)}/>
      <div className="club-address-state"><DesktopSelect label="UF" showLabel fullWidth value={value.estado} options={[{value:'',label:'UF'},...UFS]} onChange={v => mudar('estado', v)}/></div>
      <Input className="club-address-street" label="Logradouro" maxLength={160} value={value.logradouro} onChange={e => mudar('logradouro', e.target.value)}/>
      <Input className="club-address-number" label="Número" maxLength={20} value={value.numero} onChange={e => mudar('numero', e.target.value)}/>
      <Input className="club-address-district" label="Bairro" maxLength={160} value={value.bairro} onChange={e => mudar('bairro', e.target.value)}/>
      <Input className="club-address-extra" label="Complemento (opcional)" maxLength={160} value={value.complemento} onChange={e => mudar('complemento', e.target.value)}/>
    </fieldset>
    {(buscando || aviso) && <p className="club-settings-hint" role="status">{buscando ? 'Consultando CEP…' : aviso}</p>}
  </ClubSettingsSection>;
}

export function EscudoField({ value, nome, onChange }: { value?: string | null; nome: string; onChange: (v: string | null) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  async function lerImagem(arquivo?: File) {
    if (!arquivo) return;
    setErro(''); setBusy(true);
    let bitmap: ImageBitmap | undefined;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type) || arquivo.size > 5 * 1024 * 1024) throw new Error('Escolha PNG, JPEG ou WebP de até 5 MB.');
      bitmap = await createImageBitmap(arquivo);
      const canvas = document.createElement('canvas');
      const escala = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * escala)); canvas.height = Math.max(1, Math.round(bitmap.height * escala));
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const imagem = canvas.toDataURL('image/webp', 0.82);
      if (imagem.length > 87500) throw new Error('O escudo ficou acima de 64 KB. Escolha uma imagem mais simples.');
      onChange(imagem);
    } catch (e) { setErro((e as Error).message || 'Não foi possível ler a imagem.'); }
    finally { bitmap?.close(); setBusy(false); if (file.current) file.current.value = ''; }
  }
  return <div className="club-crest full">
    <ClubBadge name={nome} src={value} size={58}/>
    <div><strong>Escudo do clube</strong><p className="dica">PNG, JPEG ou WebP. A imagem será ajustada para a plataforma.</p>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => void lerImagem(e.target.files?.[0])}/>
      <div className="actions"><Btn type="button" size="sm" variant="ghost" disabled={busy} onClick={() => file.current?.click()}><Icon name="edit" size={15}/>{busy ? 'Preparando…' : value ? 'Alterar escudo' : 'Escolher escudo'}</Btn>
      {value && <Btn type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onChange(null)}>Remover</Btn>}</div>
      {erro && <p role="alert" className="notice-error">{erro}</p>}
    </div>
  </div>;
}
