import { useEffect, useId, useRef } from 'react'
import { Button } from './Button'
export function Modal({ open, onClose, title, children }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    return () => { if (dialog.open) dialog.close() }
  }, [open])
  return <dialog ref={ref} className="modal" aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
  }}>
    <div className="modal__header"><h2 id={id}>{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Закрыть окно">×</Button></div>{children}
  </dialog>
}
