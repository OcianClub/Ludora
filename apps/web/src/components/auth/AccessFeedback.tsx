export function AccessFeedback({ message, success = false }: { message: string; success?: boolean }) {
  if (!message) return null;
  return <div className={`access-feedback${success ? ' is-success' : ''}`} role={success ? 'status' : 'alert'}>{message}</div>;
}

export function AccessSteps({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="access-steps" aria-label={`Etapa ${step} de ${labels.length}: ${labels[step - 1]}`}>
      <span>Etapa {step} de {labels.length} · {labels[step - 1]}</span>
      <div aria-hidden="true">{labels.map((label, index) => <i key={label} className={index < step ? 'is-active' : ''} />)}</div>
    </div>
  );
}
