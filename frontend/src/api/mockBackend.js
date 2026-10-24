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
  }
};