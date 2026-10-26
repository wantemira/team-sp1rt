import { useId } from 'react'
/** Состоянием вкладок управляет родитель; элемент: { value, label, content, disabled? }. */
export function Tabs({ items, value, onChange, label = 'Разделы', variant = 'line' }) {
  const id = useId()
  const enabled = items.filter(item => !item.disabled)
  function onKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    let index = enabled.findIndex(item => item.value === value)
    if (event.key === 'Home') index = 0
    else if (event.key === 'End') index = enabled.length - 1
    else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length
    if (!enabled[index]) return
    onChange(enabled[index].value)
    document.getElementById(`${id}-tab-${enabled[index].value}`)?.focus()
  }
  return <div className="tabs">
    <div className={`tabs__list tabs__list--${variant}`} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map(item => <button key={item.value} type="button" role="tab" id={`${id}-tab-${item.value}`} aria-controls={`${id}-panel-${item.value}`} aria-selected={item.value === value} tabIndex={item.value === value ? 0 : -1} disabled={item.disabled} onClick={() => onChange(item.value)}>{item.label}</button>)}
    </div>
    {items.map(item => <div key={item.value} role="tabpanel" id={`${id}-panel-${item.value}`} aria-labelledby={`${id}-tab-${item.value}`} hidden={item.value !== value} tabIndex={0}>{item.value === value && item.content}</div>)}
  </div>
}
export function FilterChips({ items, value, onChange, label = 'Фильтры' }) {
  return <div className="filter-chips" role="group" aria-label={label}>{items.map(item => <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)}>{item.label}{item.count != null && <span>{item.count}</span>}</button>)}</div>
}
