import { Button } from '../ui'
const clientNavigation = [
  { value: 'dashboard', label: 'Обзор', icon: '◉' },
  { value: 'application', label: 'Продукты', icon: '▤' },
  { value: 'applications', label: 'Мои заявки', icon: '□' },
  { value: 'documents', label: 'Документы', icon: '↗' },
]
const employeeNavigation = [
  { value: 'queue', label: 'Очередь', icon: '◉' },
  { value: 'review', label: 'На рассмотрении', icon: '▤' },
  { value: 'history', label: 'История решений', icon: '□' },
]
export function AppShell({ role = 'client', activeItem, onNavigate, userName, onLogout, children }) {
  const navigation = role === 'employee' ? employeeNavigation : clientNavigation
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">К содержимому</a>
    <header className="app-header">
      <button className="brand" type="button" onClick={() => onNavigate(navigation[0].value)} aria-label="Бизнес — на главную"><span className="brand__mark">А</span><strong>Бизнес</strong></button>
      <nav className="main-nav" aria-label="Основная навигация">{navigation.map(item => <button type="button" key={item.value} aria-current={activeItem === item.value ? 'page' : undefined} onClick={() => onNavigate(item.value)}>{item.label}</button>)}</nav>
      <div className="user-menu"><span>{userName}</span>{onLogout && <Button variant="ghost" onClick={onLogout}>Выйти</Button>}</div>
    </header>
    <div className="app-body">
      <nav className="side-rail" aria-label="Быстрая навигация">{navigation.map(item => <button type="button" key={item.value} aria-label={item.label} title={item.label} aria-current={activeItem === item.value ? 'page' : undefined} onClick={() => onNavigate(item.value)}><span aria-hidden="true">{item.icon}</span></button>)}</nav>
      <main id="main-content" className="app-content" tabIndex={-1}>{children}</main>
    </div>
  </div>
}
export function PageHeader({ title, description, action }) {
  return <div className="page-header"><div><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div>
}
