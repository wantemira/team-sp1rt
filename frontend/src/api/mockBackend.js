// src/api/mockBackend.js

const getDB = () => JSON.parse(localStorage.getItem('mock_db') || '{"apps": [], "nextId": 1043}');
const saveDB = (db) => localStorage.setItem('mock_db', JSON.stringify(db));

// Имитация задержки сети (чтобы работали лоадеры)
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
    // Имитация ошибки 409 Conflict
    if (app.version !== data.version) {
      const err = new Error('Данные устарели. Пожалуйста, обновите страницу.');
      err.status = 409;
      throw err;
    }

    db.apps[index] = { 
      ...app, 
      ...data, 
      version: app.version + 1,
    };
    saveDB(db);
    return db.apps[index];
  },

  submit: async (id, version) => {
    await delay(500);
    const db = getDB();
    const index = db.apps.findIndex(a => String(a.id) === String(id));
    if (index === -1) throw new Error('Заявка не найдена');
    
    const app = db.apps[index];
    if (app.version !== version) {
      const err = new Error('Данные устарели при отправке');
      err.status = 409;
      throw err;
    }

    db.apps[index] = {
      ...app,
      status: 'CHECKING',
      version: app.version + 1,
      next_actions: [], // Пока проверяется, действий нет
      status_history: [
        ...app.status_history, 
        { status: 'CHECKING', created_at: new Date().toISOString(), comment: 'Заявка отправлена на проверку' }
      ]
    };
    saveDB(db);
    return db.apps[index];
  }
};