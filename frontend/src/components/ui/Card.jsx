export function Card({ as: Tag = 'section', title, description, action, children, className = '', ...props }) {
  return <Tag {...props} className={`card ${className}`}>
    {(title || description || action) && <div className="card__header">
      <div>{title && <h2 className="section-heading">{title}</h2>}{description && <p className="muted">{description}</p>}</div>{action}
    </div>}{children}
  </Tag>
}
