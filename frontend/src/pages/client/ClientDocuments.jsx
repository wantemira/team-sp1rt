import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/layout/AppShell'
import { Button, Card, Field, InlineAlert, LoadingState } from '../../components/ui'
import { DocumentList, DocumentUpload } from '../../components/credit'

export default function ClientDocuments() {
  const { api } = useAuth()
  const [apps, setApps] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [docType, setDocType] = useState('financial_report')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api.applications.list(controller.signal).then(data => { setApps(data); setError('') })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [api, attempt])
  const available = apps?.filter(item => item.status !== 'REJECTED') || []
  const selected = available.find(item => String(item.id) === selectedId) || available[0]
  async function upload(file) {
    if (!selected || busy) return
    setBusy(true); setError('')
    const form = new FormData()
    form.append('document_type', docType); form.append('file', file)
    try { await api.documents.upload(selected.id, form); setAttempt(value => value + 1) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  async function download(doc) {
    try {
      const blob = await api.documents.download(doc.applicationId, doc.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `Документ-${doc.id}`; link.click()
      URL.revokeObjectURL(url)
    } catch (err) { setError(err.message) }
  }
  if (!apps && !error) return <LoadingState />
  const documents = (apps || []).flatMap(item => item.documents.map(doc => ({
    ...doc, applicationId: item.id, file_name: `Заявка №${item.id}`,
  })))
  return <>
    <PageHeader title="Документы" description="Файлы сохраняются в выбранной заявке" />
    {error && <InlineAlert tone="danger">{error}<Button onClick={() => setAttempt(value => value + 1)}>Обновить</Button></InlineAlert>}
    <div className="form-layout">
      <Card title="Загрузить документ">{selected ? <div className="stack">
        <Field as="select" label="Заявка" value={String(selected.id)} disabled={busy} onChange={event => setSelectedId(event.target.value)}>
          {available.map(item => <option key={item.id} value={item.id}>Заявка №{item.id}</option>)}
        </Field>
        <Field as="select" label="Тип документа" value={docType} disabled={busy} onChange={event => setDocType(event.target.value)}>
          <option value="financial_report">Финансовый отчёт</option><option value="charter">Учредительные документы</option><option value="other">Другой документ</option>
        </Field>
        <DocumentUpload onFile={upload} busy={busy} />
      </div> : <p className="muted">Сначала создайте заявку, к которой нужно приложить файл.</p>}</Card>
      <Card title="Мои документы"><DocumentList documents={documents} onDownload={download} /></Card>
    </div>
  </>
}
