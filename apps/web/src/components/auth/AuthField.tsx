import { forwardRef, InputHTMLAttributes, ReactNode, useId, useState } from 'react';
import { Icon } from '../Icon';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string;
  error?: string;
  hint?: string;
  action?: ReactNode;
  icon?: 'user' | 'email' | 'password' | 'code';
};

export const AuthField = forwardRef<HTMLInputElement, Props>(function AuthField(
  { label, error, hint, action, icon = 'email', type = 'text', className = '', ...props }, ref,
) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  const description = [error || hint ? `${id}-feedback` : '', props['aria-describedby']].filter(Boolean).join(' ');

  return (
    <div className={`access-field ${className}`}>
      <div className="access-label-row">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      <div className={`access-input-row${error ? ' has-error' : ''}`}>
        {icon === 'user' ? <Icon name="user" size={20} /> : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            {icon === 'password' ? <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>
              : icon === 'code' ? <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 10h10M7 14h4" /></>
                : <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>}
          </svg>
        )}
        <input {...props} id={id} ref={ref} type={password && visible ? 'text' : type}
          aria-invalid={error ? true : undefined} aria-describedby={description || undefined} />
        {password && (
          <button type="button" className="access-eye" disabled={props.disabled}
            aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible}
            onClick={() => setVisible(current => !current)}>
            <Icon name={visible ? 'eyeOff' : 'eye'} size={20} />
          </button>
        )}
      </div>
      {(error || hint) && <p id={`${id}-feedback`} className="access-field-feedback" aria-live="polite">{error || hint}</p>}
    </div>
  );
});
