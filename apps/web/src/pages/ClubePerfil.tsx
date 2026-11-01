import { useEffect, useRef, useState, type FormEvent } from 'react';
import { requestJson, type Clube } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Input, Select, LoadingSkeleton } from '../components/UI';
import { ClubBadge } from '../components/Brand';
import { Icon } from '../components/Icon';
import { Toast } from '../components/Toast';
import { CLUB_STATES, EMPTY_CLUB_ADDRESS, formatClubCep, normalizeClubForm, prepareClubCrest, validateClubForm,
  type ClubAddress, type ClubForm, type ClubFormErrors } from '../utils/clubProfile';
import './ClubePerfil.css';

type ClubProfile = Omit<Clube, 'escudo'> & ClubForm;

export default function ClubePerfil() {
  const { clube, definirClube } = useAuth();
  const [data, setData] = useState<ClubProfile | null>(null);
  const [original, setOriginal] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<ClubFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageName, setImageName] = useState('');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const imageVersion = useRef(0);
  const request = useRef<AbortController | null>(null);
  const editable = clube?.meuPapel === 'ADMIN';
  const dirty = data !== null && JSON.stringify(normalizeClubForm(data)) !== original;

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    requestJson<ClubProfile>('/clube/perfil', { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setData(result);
      setOriginal(JSON.stringify(normalizeClubForm(result)));
    }).catch(() => {
      if (!controller.signal.aborted) setError('Não foi possível carregar os dados do clube. Verifique sua conexão e tente novamente.');
    });
    return () => {
      controller.abort();
      request.current?.abort();
      imageVersion.current++;
    };
  }, [clube?.id, version]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update<K extends keyof ClubForm>(key: K, value: ClubForm[K]) {
    setData(previous => previous ? { ...previous, [key]: value } : previous);
    setErrors(previous => ({ ...previous, [key]: undefined }));
    setError('');
  }

  function updateAddress(key: keyof ClubAddress, value: string) {
    setData(previous => previous ? { ...previous, endereco: { ...EMPTY_CLUB_ADDRESS, ...previous.endereco, [key]: value } } : previous);
    setErrors(previous => ({ ...previous, [key]: undefined }));
    setError('');
  }

  async function selectImage(file: File) {
    const current = ++imageVersion.current;
    setImageBusy(true);
    setErrors(previous => ({ ...previous, escudo: undefined }));
    try {
      const image = await prepareClubCrest(file);
      if (current !== imageVersion.current) return;
      update('escudo', image);
      setImageName(file.name);
    } catch (failure) {
      if (current === imageVersion.current) setErrors(previous => ({ ...previous, escudo: failure instanceof Error ? failure.message : 'Não foi possível preparar a imagem.' }));
    } finally {
      if (current === imageVersion.current) setImageBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!data || busy || imageBusy || !editable || !dirty) return;
    const validation = validateClubForm(data);
    setErrors(validation);
    if (Object.keys(validation).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await requestJson<ClubProfile>('/clube/perfil', {
        method: 'PATCH', signal: controller.signal, body: JSON.stringify(normalizeClubForm(data)),
      });
      if (controller.signal.aborted) return;
      setData(result);
      setOriginal(JSON.stringify(normalizeClubForm(result)));
      setImageName('');
      if (clube) definirClube({ ...clube, ...result, escudo: result.escudo || undefined });
      setMessage('As alterações do clube foram salvas.');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error && !/fetch|network/i.test(failure.message)
        ? failure.message : 'Não foi possível salvar. Verifique sua conexão e tente novamente. Seus dados continuam aqui.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (!data) return error ? <div className="club-settings-load-error" role="alert">
    <Icon name="alert" size={26} /><p>{error}</p><Btn onClick={() => setVersion(value => value + 1)}>Tentar novamente</Btn>
  </div> : <LoadingSkeleton kind="form" />;

  const address = { ...EMPTY_CLUB_ADDRESS, ...data.endereco };
  return <div className="club-settings-page">
    <header className="club-settings-heading">
      <p className="eyebrow">{editable ? 'Gestão do clube' : 'Clube Ludora'}</p>
      <h1 className="page-title">{editable ? 'Configurações do clube' : 'Sobre o clube'}</h1>
      <p className="page-sub">{editable ? 'Cuide da identidade e dos dados da sede do seu clube.' : 'Conheça a identidade e a sede do clube.'}</p>
    </header>

    <form ref={formRef} onSubmit={save} noValidate>
      <section className="club-settings-section" aria-labelledby="club-identity-title">
        <div className="club-settings-section-heading">
          <Icon name="shield" size={21} />
          <div><h2 id="club-identity-title">Identidade do clube</h2><p>Como o clube aparece nas partidas e nas outras telas.</p></div>
        </div>
        <fieldset disabled={busy || imageBusy}>
          <legend className="sr-only">Identidade do clube</legend>
          <div className="club-crest-editor">
            <span className="club-crest-preview" role="img" aria-label={`Prévia do escudo de ${data.nome || 'seu clube'}`}>
              <ClubBadge src={data.escudo} name={data.nome} size={88} />
            </span>
            <div className="club-crest-controls">
              <strong>Escudo do clube</strong>
              <p>PNG, JPG ou WebP de até 8 MB.</p>
              {editable && <div className="club-crest-buttons">
                <Btn type="button" size="sm" variant="ghost" aria-invalid={!!errors.escudo} aria-describedby={errors.escudo ? 'club-crest-error' : undefined} onClick={() => fileInput.current?.click()}>
                  <Icon name="edit" size={16} />{imageBusy ? 'Preparando…' : data.escudo ? 'Alterar escudo' : 'Enviar escudo'}
                </Btn>
                {data.escudo && <button type="button" className="club-settings-text-button" onClick={() => { update('escudo', null); setImageName(''); }}>Remover</button>}
              </div>}
              {imageName && <span className="club-crest-file" data-tooltip={imageName} data-tooltip-overflow>Selecionado: {imageName}</span>}
            </div>
            <input ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp"
              aria-label="Selecionar escudo do clube" disabled={!editable || busy || imageBusy} aria-invalid={!!errors.escudo}
              aria-describedby={errors.escudo ? 'club-crest-error' : undefined} onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void selectImage(file);
              }} />
          </div>
          {errors.escudo && <p id="club-crest-error" className="field-error" role="alert">{errors.escudo}</p>}
          <Input label="Nome do clube" name="nome" value={data.nome} placeholder="Ex.: Ocian Praia Clube" maxLength={120}
            readOnly={!editable} autoComplete="organization" error={errors.nome} onChange={event => update('nome', event.target.value)} />
          {editable && <details className="club-crest-link">
            <summary>Usar um link de imagem<Icon name="chevronRight" size={15} /></summary>
            <Input label="Link do escudo" type="url" placeholder="https://…" maxLength={2000}
              value={data.escudo?.startsWith('data:') ? '' : data.escudo || ''} onChange={event => { update('escudo', event.target.value); setImageName(''); }} />
            <p>Você também pode escolher um arquivo em “Alterar escudo”.</p>
          </details>}
        </fieldset>
      </section>

      <section className="club-settings-section" aria-labelledby="club-address-title">
        <div className="club-settings-section-heading">
          <Icon name="location" size={21} />
          <div><h2 id="club-address-title">Sede e endereço <span>Opcional</span></h2><p>Cadastre a localização de referência do clube.</p></div>
        </div>
        <p className="club-address-note"><Icon name="info" size={18} />A sede aparece como sugestão ao organizar partidas. O local de cada jogo pode ser diferente.</p>
        <fieldset disabled={busy} className="club-address-grid">
          <legend className="sr-only">Endereço da sede</legend>
          <Input className="club-address-cep" name="cep" label="CEP" inputMode="numeric" autoComplete="postal-code" value={formatClubCep(address.cep)}
            placeholder="00000-000" maxLength={9} readOnly={!editable} error={errors.cep} onChange={event => updateAddress('cep', event.target.value.replace(/\D/g, '').slice(0, 8))} />
          <Input className="club-address-city" name="cidade" label="Cidade" autoComplete="address-level2" value={address.cidade}
            placeholder="Ex.: Praia Grande" maxLength={160} readOnly={!editable} error={errors.cidade} onChange={event => updateAddress('cidade', event.target.value)} />
          <div className="club-address-state">
            <Select label="UF" name="estado" value={address.estado} emptyLabel="UF" disabled={!editable} aria-invalid={!!errors.estado}
              aria-describedby={errors.estado ? 'club-state-error' : undefined} autoComplete="address-level1"
              options={CLUB_STATES.map(state => ({ value: state, label: state }))} onChange={event => updateAddress('estado', event.target.value)} />
            <span className="club-state-chevron"><Icon name="chevronRight" size={16} /></span>
            {errors.estado && <span id="club-state-error" className="field-error">{errors.estado}</span>}
          </div>
          <Input className="club-address-street" name="logradouro" label="Logradouro" autoComplete="address-line1" value={address.logradouro}
            placeholder="Rua, avenida…" maxLength={160} readOnly={!editable} error={errors.logradouro} onChange={event => updateAddress('logradouro', event.target.value)} />
          <Input className="club-address-number" name="numero" label="Número" value={address.numero}
            placeholder="Nº ou S/N" maxLength={160} readOnly={!editable} error={errors.numero} onChange={event => updateAddress('numero', event.target.value)} />
          <Input className="club-address-district" name="bairro" label="Bairro · opcional" autoComplete="address-level3" value={address.bairro}
            placeholder="Ex.: Ocian" maxLength={160} readOnly={!editable} error={errors.bairro} onChange={event => updateAddress('bairro', event.target.value)} />
          <Input className="club-address-extra" name="complemento" label="Complemento · opcional" autoComplete="address-line2" value={address.complemento}
            placeholder="Ex.: bloco B, quadra 2" maxLength={160} readOnly={!editable} error={errors.complemento} onChange={event => updateAddress('complemento', event.target.value)} />
        </fieldset>
        <p className="club-settings-hint">{editable ? 'Se cadastrar a sede, preencha CEP, cidade, UF e logradouro.' : 'Somente administradores podem alterar os dados do clube.'}</p>
      </section>

      {error && <div className="club-settings-save-error" role="alert"><Icon name="alert" size={18} /><p>{error}</p></div>}
      {editable && <footer className="club-settings-actions">
        <span role="status">{imageBusy ? 'Preparando a imagem…' : busy ? 'Salvando alterações…' : dirty ? 'Alterações ainda não salvas' : 'Nenhuma alteração pendente'}</span>
        <Btn type="submit" disabled={!dirty || busy || imageBusy}><Icon name="checkAll" size={18} />{busy ? 'Salvando…' : 'Salvar alterações'}</Btn>
      </footer>}
    </form>
    <Toast message={message} onClose={() => setMessage('')} />
  </div>;
}
