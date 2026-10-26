import { Button } from '../ui'
import { ACTIONS } from '../../lib/contracts'
/** Доступные действия определяет сервер через next_actions. */
export function ApplicationActions({ nextActions = [], onAction, busy = false }) {
  const actions = [...new Set(nextActions)].filter(action => ACTIONS[action])
  if (!actions.length) return null
  return <div className="application-actions">{actions.map(action => <Button key={action} variant={ACTIONS[action].variant} loading={busy === action} disabled={Boolean(busy)} onClick={() => onAction(action)}>{ACTIONS[action].label}</Button>)}</div>
}
