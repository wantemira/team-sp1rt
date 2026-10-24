import { Button, Card } from '../components/ui'
import { ApplicationActions, ApplicationsTable, FinancingBanner, MetricCard, NewsFeed, StatusTimeline } from '../components/credit'
import { PageHeader } from '../components/layout/AppShell'
import { demoApplications, demoNews } from './fixtures'
import { formatMoney } from '../lib/format'
export function DashboardDemo({ onNavigate, onOpen }) {
  const application = demoApplications[0]
  const approved = demoApplications.filter(item => item.status === 'APPROVED')
  return <>
    <PageHeader title="Добрый день, Александр" description="ООО Вектор · Ваш бизнес движется вперед" />
    <FinancingBanner onApply={() => onNavigate('application')} />
    <div className="metrics-grid">
      <MetricCard label="Активные заявки" value={demoApplications.length} hint="Одна заявка требует вашего ответа" />
      <MetricCard label="Одобренная сумма" value={formatMoney(approved[0]?.approved_amount)} hint="Предложение готово к просмотру" />
      <MetricCard label="Ваш следующий шаг" value="Дополнить данные" hint={`Заявка №${application.id} · оборотный кредит`} />
    </div>
    <div className="dashboard-grid">
      <Card title="Мои заявки" action={<Button variant="ghost" onClick={() => onNavigate('applications')}>Все заявки →</Button>}><ApplicationsTable applications={demoApplications} onOpen={onOpen} onCreate={() => onNavigate('application')} /></Card>
      <Card title={`Заявка №${application.id}`} description="Что происходит сейчас" className="status-card"><StatusTimeline history={application.status_history} /><ApplicationActions nextActions={application.next_actions} onAction={() => onOpen(application.id)} /></Card>
    </div>
    <NewsFeed items={demoNews} />
  </>
}
