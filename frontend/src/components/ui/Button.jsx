export function Button({ children, variant = 'primary', loading = false, disabled = false, className = '', type = 'button', ...props }) {
  return <button {...props} type={type} className={`button button--${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading && <span className="spinner" aria-hidden="true" />}{children}
  </button>
}
