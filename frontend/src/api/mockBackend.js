// src/api/mockBackend.js

const getDB = () => JSON.parse(localStorage.getItem('mock_db') || '{"apps": [], "nextId": 1043}');
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

  create: async (data) => {
    await delay(500);
    const db = getDB();
    const newApp = {
      id: db.nextId++,
      status: 'DRAFT',
      version: 1,
      created_at: new Date().toISOString(),
      status_history: [{ status: 'DRAFT', created_at: new Date().toISOString(), comment: 'Черновик создан' }],
      next_actions: ['submit'],
      ...data
    };
    db.apps.push(newApp);
    saveDB(db);
    return newApp;
  },

  update: async (id, data) => {
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    if (index === -1) throw new Error('Заявка не найдена');
    
    const app = db.apps[index];
    if (app.version !== data.version) {
      const err = new Error('Данные устарели. Пожалуйста, обновите страницу.');
      err.status = 409;
      throw err;
    }

    db.apps[index] = { ...app, ...data, version: app.version + 1 };
    saveDB(db);
    return db.apps[index];
  },

  submit: async (id, version) => {
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    if (db.apps[index].version !== version) {
      const err = new Error('Данные устарели при отправке'); err.status = 409; throw err;
    }

    db.apps[index] = {
      ...db.apps[index],
      status: 'CHECKING',
      version: db.apps[index].version + 1,
      next_actions: [],
      status_history: [...db.apps[index].status_history, { status: 'CHECKING', created_at: new Date().toISOString(), comment: 'Заявка отправлена на проверку' }]
    };
    saveDB(db);

    // --- ИМИТАЦИЯ СОТРУДНИКА ---
    // Через 3 секунды после отправки, сотрудник просит дозаполнить поле
    setTimeout(() => {
      const db2 = getDB();
      const idx2 = db2.apps.findIndex(a => String(a.id) === String(id));
      if (idx2 !== -1) {
        db2.apps[idx2].status = 'NEEDS_INFO';
        db2.apps[idx2].version += 1;
        db2.apps[idx2].info_comment = 'Не хватает данных о выручке за прошлый год.';
        db2.apps[idx2].missing_fields = ['annual_revenue'];
        db2.apps[idx2].next_actions = ['fill'];
        db2.apps[idx2].status_history.push({ status: 'NEEDS_INFO', created_at: new Date().toISOString(), comment: 'Запрошены дополнительные данные' });
        saveDB(db2);
      }
    }, 3000);

    return db.apps[index];
  },

  fill: async (id, businessData, version) => {
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    if (db.apps[index].version !== version) {
      const err = new Error('Конфликт версий'); err.status = 409; throw err;
    }

    db.apps[index] = {
      ...db.apps[index],
      business_data: { ...db.apps[index].business_data, ...businessData },
      status: 'APPROVED',
      version: db.apps[index].version + 1,
      next_actions: ['sign'],
      approved_amount: '1500000.00',
      approved_rate: '14.5',
      status_history: [...db.apps[index].status_history, { status: 'APPROVED', created_at: new Date().toISOString(), comment: 'Заявка одобрена' }]
    };
    saveDB(db);
    return db.apps[index];
  },

  sign: async (id, version) => {
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    if (db.apps[index].version !== version) {
      const err = new Error('Конфликт версий'); err.status = 409; throw err;
    }

    db.apps[index] = {
      ...db.apps[index],
      status: 'ISSUED',
      version: db.apps[index].version + 1,
      next_actions: [],
      status_history: [...db.apps[index].status_history, { status: 'ISSUED', created_at: new Date().toISOString(), comment: 'Средства выданы (имитация)' }]
    };
    saveDB(db);
    return db.apps[index];
  }
};