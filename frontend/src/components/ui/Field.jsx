import { useId } from 'react'
export function Field({ label, hint, error, id, as: Control = 'input', className = '', children, ...props }) {
  const generatedId = useId()
  const controlId = id || generatedId
  const messageId = `${controlId}-message`
  return <div className={`field ${className}`}>
    <label htmlFor={controlId} className="field__label">{label}</label>
    <Control {...props} id={controlId} className="field__control" aria-invalid={Boolean(error)} aria-describedby={error || hint ? messageId : undefined}>{children}</Control>
    {(error || hint) && <p id={messageId} className={error ? 'field__error' : 'field__hint'}>{error || hint}</p>}
  </div>
}
