import { useState } from 'react'
import { commentText, decisionText } from '../../lib/decisionText'
import { riskText, riskHint, factorText, factorExplanation, checkTypeText, profileName } from '../../lib/displayText'
import { Card, EmptyState, Field, InlineAlert, Tabs } from '../ui'
import { StatusBadge } from '../ui/Badge'
import { formatMoney } from '../../lib/format'
import { ApplicationActions } from './ApplicationActions'
import { MetricCard, StatusTimeline } from './Overview'
import { CreditOffer } from './CreditOffer'
import { groupChecks } from '../../lib/checks'
import { FinancialBasis } from './FinancialBasis'
export function ApplicationQueue({ applications = [], selectedId, onSelect, query, onQueryChange }) {
  const visible = applications.filter(item => `${item.company_name} ${item.client?.inn || ''} ${item.id}`.toLowerCase().includes(query.toLowerCase()))
  return <Card className="queue-card"><Field label="Поиск по компании или ИНН" type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Найти заявку" />
    <ul className="application-queue" aria-label="Заявки">{visible.map(item => <li key={item.id}><button type="button" aria-current={item.id === selectedId ? 'true' : undefined} onClick={() => onSelect(item.id)}><strong>{profileName(item.company_name)}</strong><span>{formatMoney(item.requested_amount)} · №{item.id}</span></button></li>)}</ul>
    {!visible.length && <EmptyState title="Заявок не найдено" description="Измените поиск или фильтр." />}
  </Card>
}
export function CheckResults({ checks = [] }) {
  if (!checks.length) return <p className="muted">Проверки еще не выполнены.</p>
  const { current, previous } = groupChecks(checks)
  return <div className="stack stack--compact"><CheckList checks={current} label="Текущие результаты проверок" />{!!previous.length && <details><summary>Предыдущие попытки ({previous.length})</summary><CheckList checks={previous} label="История попыток проверок" /></details>}</div>
}
function CheckList({ checks, label }) {
  return <ul className="check-results" aria-label={label}>{checks.map((check, index) => <li key={check.id ?? index} className={check.status === 'SUCCESS' ? 'check-results__success' : 'check-results__warning'}><span aria-hidden="true">{check.status === 'SUCCESS' ? '✓' : '○'}</span><div><strong>{checkTypeText(check.check_type)}</strong><p>{check.status === 'SUCCESS' ? 'Ответ источника получен' : check.status === 'TIMEOUT' ? 'Источник не ответил' : check.status === 'ERROR' ? 'Ошибка источника' : 'Ожидаем результат'}</p></div></li>)}</ul>
}
export function ScoringPanel({ score, grade, factors = [] }) {
  return <div className="stack stack--compact"><div className="review-metrics"><MetricCard label="Оценка платёжеспособности" value={score == null ? '—' : `${score} / 100`} hint="Расчёт на синтетических данных" /><MetricCard label="Уровень риска" value={riskText(grade)} hint={riskHint(score)} /></div>
    {!!factors.length && <dl className="factor-list">{factors.map(factor => <div key={factor.code}><dt>{factorText(factor)}</dt><dd>{factor.points} баллов{factorExplanation(factor.explanation) && <small>{factorExplanation(factor.explanation)}</small>}</dd></div>)}</dl>}
  </div>
}
export function EmployeeApplicationCard({ application, onAction, busy = false }) {
  const [tab, setTab] = useState('general')
  if (!application) return <Card><EmptyState title="Выберите заявку" /></Card>
  const general = <div className="stack">
    <div className="review-metrics"><MetricCard label="Запрошено" value={formatMoney(application.requested_amount)} hint={`Срок · ${application.requested_term_months} месяцев`} /><MetricCard label="Оценка платёжеспособности" value={application.score == null ? '—' : `${application.score} / 100`} hint="Расчёт на синтетических данных" /><MetricCard label="Уровень риска" value={riskText(application.risk_grade)} hint={riskHint(application.score)} /></div>
    <FinancialBasis application={application} />
    <CheckResults checks={application.checks} />
    <CreditOffer application={application} />
    <InlineAlert title={application.decision_reason_code === 'EXTERNAL_CHECK_UNAVAILABLE' ? 'Требуется повторная проверка' : application.status === 'MANUAL_REVIEW' ? 'Заявка требует решения сотрудника' : 'Результат рассмотрения'} tone={application.decision_reason_code === 'EXTERNAL_CHECK_UNAVAILABLE' ? 'warning' : 'info'}>{application.info_comment ? commentText(application.info_comment, 'Заполните запрошенные сведения в карточке заявки.') : decisionText(application.decision_reason_code)}</InlineAlert>
  </div>
  return <Card className="employee-detail" title={`${profileName(application.company_name)} · №${application.id}`} action={<StatusBadge status={application.status} />}>
    <Tabs value={tab} onChange={setTab} items={[
      { value: 'general', label: 'Общая информация', content: general },
      { value: 'checks', label: 'Проверки и скоринг', content: <div className="stack"><CheckResults checks={application.checks} /><ScoringPanel score={application.score} grade={application.risk_grade} factors={application.scoring_result?.factors} /></div> },
      { value: 'history', label: 'История', content: <StatusTimeline history={application.status_history} /> },
    ]} />
    <ApplicationActions nextActions={application.next_actions} busy={busy} onAction={onAction} />
  </Card>
}
