// src/api/mockBackend.js

const getDB = () => {
  let db = JSON.parse(localStorage.getItem('mock_db'));
  
  // Если база пустая, создаем стартовую заявку для сотрудника
  if (!db) {
    db = { 
      apps: [{
        id: 1041,
        status: 'MANUAL_REVIEW',
        version: 1,
        created_at: new Date().toISOString(),
        requested_amount: '3000000.00',
        requested_term_months: 24,
        purpose: 'Расширение производства',
        status_history: [{ status: 'MANUAL_REVIEW', created_at: new Date().toISOString(), comment: 'Требуется ручная проверка' }],
        next_actions: ['approve', 'reject', 'request_info']
      }], 
      nextId: 1042 
    };
    localStorage.setItem('mock_db', JSON.stringify(db));
  }
  return db;
};

const saveDB = (db) => localStorage.setItem('mock_db', JSON.stringify(db));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const mockBackend = {
  getAll: async () => {
    await delay(300);
    return getDB().apps;
  },

  getById: async (id) => {
    await delay(300);
    const app = getDB().apps.find(a => String(a.id) === String(id));
    if (!app) throw new Error('Заявка не найдена');
    return app;
  },

  create: async (data) => { /* ... оставляем как было ... */ 
    await delay(500);
    const db = getDB();
    const newApp = {
      id: db.nextId++, status: 'DRAFT', version: 1, created_at: new Date().toISOString(),
      status_history: [{ status: 'DRAFT', created_at: new Date().toISOString(), comment: 'Черновик создан' }],
      next_actions: ['submit'], ...data
    };
    db.apps.push(newApp); saveDB(db); return newApp;
  },

  update: async (id, data) => { /* ... оставляем как было ... */
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    if (db.apps[index].version !== data.version) throw new Error('Конфликт версий');
    db.apps[index] = { ...db.apps[index], ...data, version: db.apps[index].version + 1 };
    saveDB(db); return db.apps[index];
  },

  submit: async (id, version) => {
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    if (db.apps[index].version !== version) {
      const err = new Error('Данные устарели при отправке'); err.status = 409; throw err;
    }

    // Сразу отправляем на ручную проверку (чтобы сотрудник мог одобрить)
    db.apps[index] = {
      ...db.apps[index],
      status: 'MANUAL_REVIEW',
      version: db.apps[index].version + 1,
      next_actions: ['approve', 'reject', 'request_info'], // Добавляем доступные действия
      status_history: [...db.apps[index].status_history, { status: 'MANUAL_REVIEW', created_at: new Date().toISOString(), comment: 'Заявка отправлена на проверку' }]
    };
    saveDB(db);
    return db.apps[index];
  },

  fill: async (id, businessData, version) => { /* ... оставляем как было ... */
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    db.apps[index] = {
      ...db.apps[index], business_data: { ...db.apps[index].business_data, ...businessData },
      status: 'APPROVED', version: db.apps[index].version + 1, next_actions: ['sign'],
      approved_amount: '1500000.00', approved_rate: '14.5',
      status_history: [...db.apps[index].status_history, { status: 'APPROVED', created_at: new Date().toISOString(), comment: 'Заявка одобрена' }]
    };
    saveDB(db); return db.apps[index];
  },

  sign: async (id, version) => { /* ... оставляем как было ... */
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    db.apps[index] = {
      ...db.apps[index], status: 'ISSUED', version: db.apps[index].version + 1, next_actions: [],
      status_history: [...db.apps[index].status_history, { status: 'ISSUED', created_at: new Date().toISOString(), comment: 'Средства выданы' }]
    };
    saveDB(db); return db.apps[index];
  },

  // --- МЕТОДЫ ДЛЯ СОТРУДНИКА ---
  
  employeeList: async (status = 'ALL') => {
    await delay(400);
    const apps = getDB().apps;
    if (status === 'ALL') return apps.filter(a => a.status !== 'DRAFT'); // Сотрудник не видит черновики
    return apps.filter(a => a.status === status);
  },

  employeeGet: async (id) => {
    await delay(300);
    const app = getDB().apps.find(a => String(a.id) === String(id));
    if (!app) throw new Error('Заявка не найдена');
    return app;
  },

  employeeAction: async (id, actionData) => {
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    const app = db.apps[index];
    
    let newStatus = app.status;
    let nextActions = [];
    let comment = '';

    if (actionData.action === 'approve') {
      newStatus = 'APPROVED'; nextActions = ['sign']; // Клиент должен подписать
      comment = 'Одобрено сотрудником';
      app.approved_amount = actionData.approved_amount || app.requested_amount;
      app.approved_rate = actionData.approved_rate || '15.0';
    } else if (actionData.action === 'reject') {
      newStatus = 'REJECTED'; nextActions = [];
      comment = actionData.comment || 'Отклонено';
    } else if (actionData.action === 'request_info') {
      newStatus = 'NEEDS_INFO'; nextActions = ['fill'];
      comment = actionData.comment || 'Запрошены данные';
      app.info_comment = comment;
      app.missing_fields = actionData.missing_fields || ['annual_revenue'];
    }

    db.apps[index] = {
      ...app, status: newStatus, version: app.version + 1, next_actions: nextActions,
      status_history: [...app.status_history, { status: newStatus, created_at: new Date().toISOString(), comment }]
    };
    saveDB(db);
    return db.apps[index];
  },

    // --- НОВОСТИ ---
  getNews: async () => {
    await delay(300);
    return [
      { 
        id: 1, 
        title: 'Изменение ставок по кредитам', 
        date: '2026-10-20', 
        excerpt: 'С 1 ноября базовая ставка снижается на 0.5%.', 
        body: 'Подробности: для всех новых заявок на оборотные средства ставка будет пересчитана автоматически. Старые договоры не затрагиваются.',
        isPersonal: true 
      },
      { 
        id: 2, 
        title: 'Новые требования к документам', 
        date: '2026-10-18', 
        excerpt: 'Теперь справку о доходах можно загрузить в формате PDF.', 
        body: 'Убедительная просьба загружать справки в формате PDF. Файлы в формате JPEG и PNG также принимаются, но могут обрабатываться дольше.',
        isPersonal: false 
      },
    ];
  },

  // --- ДОКУМЕНТЫ ---
  getDocuments: async () => {
    await delay(300);
    // Имитируем пустой список или с одним файлом
    return JSON.parse(localStorage.getItem('mock_docs') || '[]');
  },

uploadDocument: async (formData) => {
    await delay(800);
    const docs = JSON.parse(localStorage.getItem('mock_docs') || '[]');
    const file = formData.get('file');
    const type = formData.get('document_type'); 
    
    if (file.size > 5 * 1024 * 1024) {
      const err = new Error('Ошибка валидации');
      err.status = 422;
      err.details = { fields: [{ field: 'file', message: 'Максимальный размер файла 5 МБ' }] };
      throw err;
    }

    // Словарь для перевода кода в читаемый текст
    const typeLabels = {
      'financial_statement': 'Справка о доходах',
      'passport': 'Паспорт',
      'charter': 'Устав компании',
      'other': 'Прочий документ'
    };

    const newDoc = {
      id: Date.now().toString(),
      file_name: file.name,
      document_type: typeLabels[type] || 'Документ', 
      file_size: file.size,
      created_at: new Date().toISOString(),
    };
    
    docs.push(newDoc);
    localStorage.setItem('mock_docs', JSON.stringify(docs));
    return newDoc;
  },

deleteDocument: async (id) => {
    await delay(300);
    const docs = JSON.parse(localStorage.getItem('mock_docs') || '[]');
    const filtered = docs.filter(d => d.id !== id);
    localStorage.setItem('mock_docs', JSON.stringify(filtered));
  }

};