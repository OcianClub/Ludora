import { InputHTMLAttributes, useId, useState } from 'react';
import { Icon } from './Icon';

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="field">
    <label className="field-label" htmlFor={id}>Senha</label>
    <div className="password-field">
      <input {...props} id={id} className="field-input" type={visible ? 'text' : 'password'} />
      <button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible}><Icon name={visible ? 'eyeOff' : 'eye'} size={18} /></button>
    </div>
  </div>;
}
