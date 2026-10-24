import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, InlineAlert, Field } from '../../components/ui';
import { DocumentUpload, DocumentList } from '../../components/credit';
import { mockBackend } from '../../api/mockBackend';

export default function ClientDocuments() {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Состояние для выбора типа документа
  const [docType, setDocType] = useState('financial_statement');

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = () => {
    mockBackend.getDocuments().then(setDocs);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', docType); // <--- Берем выбранный тип

    try {
      await mockBackend.uploadDocument(formData);
      loadDocs();
    } catch (err) {
      if (err.status === 422) {
        setError(err.details?.fields[0]?.message || 'Ошибка валидации файла');
      } else {
        setError(err.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить документ?')) return;
    try {
      await mockBackend.deleteDocument(id);
      loadDocs(); // Обновляем список после удаления
    } catch (err) {
      setError('Не удалось удалить документ');
    }
  };

  return (
    <>
      <PageHeader title="Документы" description="Загрузка и управление документами" />
      
      {error && <InlineAlert tone="danger" style={{ marginBottom: 20 }}>{error}</InlineAlert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        <Card title="Загрузить документ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {/* Выбор типа документа */}
            <Field 
              as="select" 
              label="Тип документа" 
              value={docType} 
              onChange={e => setDocType(e.target.value)}
            >
              <option value="financial_statement">Справка о доходах</option>
              <option value="passport">Паспорт</option>
              <option value="charter">Устав компании</option>
              <option value="other">Прочий документ</option>
            </Field>
          </div>

          <DocumentUpload 
            onFile={handleFileUpload} 
            busy={isUploading} 
            error={error} 
          />
        </Card>
        
        <Card title="Мои документы">
          <DocumentList 
            documents={docs} 
            onDelete={handleDelete} // <--- Передаем функцию удаления
            onDownload={(doc) => {
              const blob = new Blob([`Имитация содержимого файла ${doc.file_name}`], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = doc.file_name;
              a.click();
              URL.revokeObjectURL(url);
            }} 
          />
        </Card>
      </div>
    </>
  );
}