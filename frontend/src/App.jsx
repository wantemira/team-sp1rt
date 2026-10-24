import { useState } from 'react'
import { AppShell, PageHeader } from './components/layout/AppShell'
import { Button, Card, InlineAlert, StatusBadge } from './components/ui'
import { ApplicationActions, ApplicationsTable, DocumentList, DocumentUpload, OfferSummary, StatusTimeline } from './components/credit'
import { ApplicationDemo } from './demo/ApplicationDemo'
import { DashboardDemo } from './demo/DashboardDemo'
import { EmployeeDemo } from './demo/EmployeeDemo'
import { ComponentsDemo } from './demo/ComponentsDemo'
import { demoApplications } from './demo/fixtures'
const views = ['dashboard', 'application', 'employee', 'components', 'applications', 'documents', 'detail']
export default function App() {
  const [view, setView] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('view')
    return views.includes(requested) ? requested : 'dashboard'
  })
  const [selectedId, setSelectedId] = useState(1042)
  const [notice, setNotice] = useState('')
  const [employeeSection, setEmployeeSection] = useState('queue')
  function navigate(next) { setNotice(''); setView(next) }
  function open(id) { setSelectedId(id); navigate('detail') }
  const application = demoApplications.find(item => item.id === selectedId) || demoApplications[0]
  const employee = view === 'employee'
  const active = employee ? employeeSection : view === 'detail' ? 'applications' : view
  return <>
    <div className="demo-toolbar"><span>Концепт · Демонстрационные данные · API не подключен</span><nav aria-label="Примеры экранов">{[['dashboard', 'Клиент'], ['application', 'Новая заявка'], ['employee', 'Сотрудник'], ['components', 'Компоненты']].map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => navigate(key)}>{label}</button>)}</nav></div>
    <AppShell role={employee ? 'employee' : 'client'} activeItem={active} userName={employee ? 'Сергей Волков' : 'Александр Иванов'} onNavigate={next => { if (employee) setEmployeeSection(next); else navigate(next) }}>
      {notice && <InlineAlert>{notice}</InlineAlert>}
      {view === 'dashboard' && <DashboardDemo onNavigate={navigate} onOpen={open} />}
      {view === 'application' && <ApplicationDemo />}
      {view === 'employee' && <EmployeeDemo historyOnly={employeeSection === 'history'} />}
      {view === 'components' && <ComponentsDemo />}
      {view === 'applications' && <><PageHeader title="Мои заявки" description="Черновики, текущие и завершенные обращения" action={<Button onClick={() => navigate('application')}>Новая заявка</Button>} /><Card><ApplicationsTable applications={demoApplications} onOpen={open} onCreate={() => navigate('application')} /></Card></>}
      {view === 'detail' && <><PageHeader title={`Заявка №${application.id}`} action={<StatusBadge status={application.status} />} /><div className="form-layout"><Card title="Ход рассмотрения"><StatusTimeline history={application.status_history} /><ApplicationActions nextActions={application.next_actions} onAction={action => setNotice(`Демонстрация: обработчик ${action} для заявки №${application.id}. Подключите API и соответствующий экран подтверждения.`)} /></Card><OfferSummary amount={application.status === 'APPROVED' ? application.approved_amount : application.requested_amount} term={application.requested_term_months} rate={application.approved_rate} approved={application.status === 'APPROVED'} /></div></>}
      {view === 'documents' && <><PageHeader title="Документы" description="Компоненты защищенной загрузки и скачивания" /><Card><div className="stack"><DocumentUpload onFile={file => setNotice(`Демонстрация: выбран файл «${file.name}». Загрузка на сервер не выполнялась.`)} /><DocumentList documents={[]} onDownload={() => {}} /></div></Card></>}
    </AppShell>
  </>
}
