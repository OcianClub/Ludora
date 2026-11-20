import { Icon } from '../Icon';

export function AccessFeedback({ message, success = false }: { message: string; success?: boolean }) {
  if (!message) return null;
  return <div className={`access-feedback${success ? ' is-success' : ''}`} role={success ? 'status' : 'alert'}>
    <Icon name={success ? 'info' : 'alert'} size={18}/><span>{message}</span>
  </div>;
}

export function AccessSteps({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="access-steps">
      <span>Etapa {step} de {labels.length}<span className="access-step-description"> · {labels[step - 1]}</span></span>
      <div aria-hidden="true">{labels.map((label, index) => <i key={label} className={index < step ? 'is-active' : ''} />)}</div>
    </div>
  );
}
