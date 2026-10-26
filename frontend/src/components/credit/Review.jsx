import { useState } from 'react'
import { decisionText } from '../../lib/decisionText'
import { Card, EmptyState, Field, InlineAlert, Tabs } from '../ui'
import { StatusBadge } from '../ui/Badge'
import { formatMoney } from '../../lib/format'
import { ApplicationActions } from './ApplicationActions'
import { MetricCard, StatusTimeline } from './Overview'
export function ApplicationQueue({ applications = [], selectedId, onSelect, query, onQueryChange }) {
  const visible = applications.filter(item => `${item.company_name} ${item.client?.inn || ''} ${item.id}`.toLowerCase().includes(query.toLowerCase()))
  return <Card className="queue-card"><Field label="Поиск по компании или ИНН" type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Найти заявку" />
    <ul className="application-queue" aria-label="Заявки">{visible.map(item => <li key={item.id}><button type="button" aria-current={item.id === selectedId ? 'true' : undefined} onClick={() => onSelect(item.id)}><strong>{item.company_name}</strong><span>{formatMoney(item.requested_amount)} · №{item.id}</span></button></li>)}</ul>
    {!visible.length && <EmptyState title="Заявок не найдено" description="Измените поиск или фильтр." />}
  </Card>
}
export function CheckResults({ checks = [] }) {
  if (!checks.length) return <p className="muted">Проверки еще не выполнены.</p>
  return <ul className="check-results">{checks.map((check, index) => <li key={check.id ?? index} className={check.status === 'SUCCESS' ? 'check-results__success' : 'check-results__warning'}><span aria-hidden="true">{check.status === 'SUCCESS' ? '✓' : '○'}</span><div><strong>{check.check_type === 'FNS' ? 'Проверка компании · ФНС' : 'Кредитная история · БКИ'}</strong><p>{check.status === 'SUCCESS' ? 'Проверка выполнена' : check.status === 'TIMEOUT' ? 'Источник не ответил — повторите проверку' : 'Ошибка источника — требуется повтор'}</p></div></li>)}</ul>
}
export function ScoringPanel({ score, grade, factors = [], rulesVersion }) {
  return <div className="stack stack--compact"><div className="review-metrics"><MetricCard label="Скоринг" value={score == null ? '—' : `${score} / 100`} hint="Демонстрационная оценка" /><MetricCard label="Риск-грейд" value={grade || '—'} hint={rulesVersion ? `Версия правил · ${rulesVersion}` : 'Расчет еще не выполнен'} /></div>
    {!!factors.length && <dl className="factor-list">{factors.map(factor => <div key={factor.code}><dt>{factor.label}</dt><dd>{factor.points} баллов{factor.explanation && <small>{factor.explanation}</small>}</dd></div>)}</dl>}
  </div>
}
export function EmployeeApplicationCard({ application, onAction, busy = false }) {
  const [tab, setTab] = useState('general')
  if (!application) return <Card><EmptyState title="Выберите заявку" /></Card>
  const general = <div className="stack">
    <div className="review-metrics"><MetricCard label="Запрошено" value={formatMoney(application.requested_amount)} hint={`Срок · ${application.requested_term_months} месяцев`} /><MetricCard label="Скоринг" value={application.score == null ? '—' : `${application.score} / 100`} hint="Демонстрационная оценка" /><MetricCard label="Риск-грейд" value={application.risk_grade || '—'} hint={application.scoring_result?.rules_version || 'Расчет не выполнен'} /></div>
    <CheckResults checks={application.checks} />
    <InlineAlert title={application.decision_reason_code === 'EXTERNAL_CHECK_UNAVAILABLE' ? 'Требуется повторная проверка' : application.status === 'MANUAL_REVIEW' ? 'Заявка требует решения сотрудника' : 'Результат рассмотрения'} tone={application.decision_reason_code === 'EXTERNAL_CHECK_UNAVAILABLE' ? 'warning' : 'info'}>{application.info_comment || decisionText(application.decision_reason_code)}</InlineAlert>
  </div>
  return <Card className="employee-detail" title={`${application.company_name} · №${application.id}`} action={<StatusBadge status={application.status} />}>
    <Tabs value={tab} onChange={setTab} items={[
      { value: 'general', label: 'Общая информация', content: general },
      { value: 'checks', label: 'Проверки и скоринг', content: <div className="stack"><CheckResults checks={application.checks} /><ScoringPanel score={application.score} grade={application.risk_grade} factors={application.scoring_result?.factors} rulesVersion={application.scoring_result?.rules_version} /></div> },
      { value: 'history', label: 'История', content: <StatusTimeline history={application.status_history} /> },
    ]} />
    <ApplicationActions nextActions={application.next_actions} busy={busy} onAction={onAction} />
  </Card>
}
