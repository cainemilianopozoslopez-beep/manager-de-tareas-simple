const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { hashPassword, isHashed } = require('./auth');
const { getLocalDateStr } = require('./dateUtils');

// GTM_DB_PATH lets tests point at a throwaway database. The legacy JSON to migrate
// from is looked up next to whatever DB path is in use, so a temp test dir won't
// accidentally pull in the real server/data.json.
const DB_PATH = process.env.GTM_DB_PATH || path.join(__dirname, 'data.db');
const LEGACY_JSON = path.join(path.dirname(DB_PATH), 'data.json');

// Defaults, used only when there is neither an existing DB nor a legacy data.json.
const defaultUser = { username: 'Caín', password: '0000', theme: 'light' };
const defaultSettings = {
  notificationMode: 'browser', senderEmail: '', senderPass: '', recipientEmail: '',
  scheduledTime: '08:00', autoSendEnabled: true, lastSentAt: null, lastSentStatus: null
};
const defaultTasks = [
  { id: 'task-1', title: 'Revisar informe de métricas del proyecto', description: 'Analizar los KPI semanales y preparar la presentación para el equipo.', priority: 'alta', category: 'trabajo', dueDate: getLocalDateStr(), dueTime: '10:00', recurrence: 'none', subtasks: [], starred: true, done: false, trash: false },
  { id: 'task-2', title: 'Enviar presupuesto de servidor a clientes', description: 'Cotización con infraestructura de Node.js y base de datos.', priority: 'urgente', category: 'trabajo', dueDate: getLocalDateStr(), dueTime: '15:00', recurrence: 'none', subtasks: [], starred: false, done: false, trash: false },
  { id: 'task-3', title: 'Comprar insumos y café para la oficina', description: 'Revisar lista de suministros del mes.', priority: 'media', category: 'personal', dueDate: getLocalDateStr(), dueTime: '18:00', recurrence: 'none', subtasks: [], starred: false, done: true, trash: false }
];

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'light'
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    notificationMode TEXT, senderEmail TEXT, senderPass TEXT, recipientEmail TEXT,
    scheduledTime TEXT, autoSendEnabled INTEGER, lastSentAt TEXT, lastSentStatus TEXT
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT,
    category TEXT,
    dueDate TEXT,
    dueTime TEXT,
    recurrence TEXT,
    subtasks TEXT,
    starred INTEGER,
    done INTEGER,
    trash INTEGER,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// ---- row <-> object mapping ----
function rowToTask(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, description: r.description || '',
    priority: r.priority, category: r.category,
    dueDate: r.dueDate, dueTime: r.dueTime || '', recurrence: r.recurrence || 'none',
    subtasks: r.subtasks ? JSON.parse(r.subtasks) : [],
    starred: !!r.starred, done: !!r.done, trash: !!r.trash,
    createdAt: r.createdAt, updatedAt: r.updatedAt
  };
}

const insertTaskStmt = db.prepare(`
  INSERT INTO tasks (id, title, description, priority, category, dueDate, dueTime, recurrence, subtasks, starred, done, trash, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
function rawInsertTask(t) {
  const now = new Date().toISOString();
  insertTaskStmt.run(
    t.id, t.title, t.description || '', t.priority || 'media', t.category || 'general',
    t.dueDate || getLocalDateStr(), t.dueTime || '', t.recurrence || 'none',
    JSON.stringify(t.subtasks || []),
    t.starred ? 1 : 0, t.done ? 1 : 0, t.trash ? 1 : 0,
    t.createdAt || now, t.updatedAt || now
  );
}

// ---- one-time seed / migration ----
function seedFromLegacyOrDefaults() {
  if (db.prepare('SELECT id FROM user WHERE id = 1').get()) return; // already initialized

  let source = { user: defaultUser, settings: defaultSettings, tasks: defaultTasks };
  if (fs.existsSync(LEGACY_JSON)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf-8'));
      if (legacy && legacy.user) {
        source = {
          user: { ...defaultUser, ...legacy.user },
          settings: { ...defaultSettings, ...(legacy.settings || {}) },
          tasks: Array.isArray(legacy.tasks) ? legacy.tasks : []
        };
        console.log(`📦 Migrando ${source.tasks.length} tareas de data.json a SQLite (data.db).`);
      }
    } catch (err) {
      console.error('No se pudo leer data.json para migrar, usando valores por defecto:', err.message);
    }
  }

  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO user (id, username, password, theme) VALUES (1, ?, ?, ?)')
      .run(source.user.username, source.user.password, source.user.theme || 'light');
    const s = source.settings;
    db.prepare(`INSERT INTO settings (id, notificationMode, senderEmail, senderPass, recipientEmail, scheduledTime, autoSendEnabled, lastSentAt, lastSentStatus)
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(s.notificationMode || 'browser', s.senderEmail || '', s.senderPass || '', s.recipientEmail || '', s.scheduledTime || '08:00', s.autoSendEnabled ? 1 : 0, s.lastSentAt || null, s.lastSentStatus || null);
    source.tasks.forEach(rawInsertTask);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
seedFromLegacyOrDefaults();

// ---- tasks API ----
function getAllTasks() {
  return db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC, id DESC').all().map(rowToTask);
}
function getTaskById(id) {
  return rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
}
function createTask(fields) {
  const now = new Date().toISOString();
  const t = {
    id: 'task-' + Date.now(),
    title: fields.title,
    description: fields.description || '',
    priority: fields.priority || 'media',
    category: fields.category || 'general',
    dueDate: fields.dueDate || getLocalDateStr(),
    dueTime: fields.dueTime || '',
    recurrence: fields.recurrence || 'none',
    subtasks: fields.subtasks || [],
    starred: false, done: false, trash: false,
    createdAt: now, updatedAt: now
  };
  rawInsertTask(t);
  return t;
}
const updateTaskStmt = db.prepare(`
  UPDATE tasks SET title=?, description=?, priority=?, category=?, dueDate=?, dueTime=?, recurrence=?, subtasks=?, starred=?, done=?, trash=?, updatedAt=?
  WHERE id=?
`);
// Merges only DEFINED fields onto the current row (so partial PUT/PATCH works).
function updateTask(id, fields) {
  const cur = getTaskById(id);
  if (!cur) return null;
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  const m = { ...cur, ...clean, updatedAt: new Date().toISOString() };
  updateTaskStmt.run(
    m.title, m.description || '', m.priority, m.category, m.dueDate, m.dueTime || '', m.recurrence || 'none',
    JSON.stringify(m.subtasks || []), m.starred ? 1 : 0, m.done ? 1 : 0, m.trash ? 1 : 0, m.updatedAt, id
  );
  return getTaskById(id);
}
function deleteTaskById(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}
function emptyTrash() {
  db.prepare('DELETE FROM tasks WHERE trash = 1').run();
}
// Applies one action to many ids atomically. Returns the number of rows affected.
function batchAction(ids, action, value) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(',');
  let sql;
  const params = [];
  if (action === 'delete') {
    sql = `DELETE FROM tasks WHERE id IN (${placeholders})`;
    params.push(...ids);
  } else {
    const set = {
      done: 'done = 1', pending: 'done = 0', trash: 'trash = 1', restore: 'trash = 0',
      category: 'category = ?'
    }[action];
    if (!set) return 0;
    sql = `UPDATE tasks SET ${set}, updatedAt = ? WHERE id IN (${placeholders})`;
    if (action === 'category') params.push((value || 'general').toLowerCase());
    params.push(now, ...ids);
  }
  db.exec('BEGIN');
  try {
    const info = db.prepare(sql).run(...params);
    db.exec('COMMIT');
    return Number(info.changes || 0);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---- user / settings API ----
function getUser() {
  const r = db.prepare('SELECT username, password, theme FROM user WHERE id = 1').get();
  return { username: r.username, password: r.password, theme: r.theme || 'light' };
}
function updateUser(fields) {
  const cur = getUser();
  const m = { ...cur, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) };
  db.prepare('UPDATE user SET username=?, password=?, theme=? WHERE id=1').run(m.username, m.password, m.theme || 'light');
  return getUser();
}
function getSettings() {
  const r = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  return {
    notificationMode: r.notificationMode, senderEmail: r.senderEmail, senderPass: r.senderPass,
    recipientEmail: r.recipientEmail, scheduledTime: r.scheduledTime,
    autoSendEnabled: !!r.autoSendEnabled, lastSentAt: r.lastSentAt, lastSentStatus: r.lastSentStatus
  };
}
function updateSettings(fields) {
  const cur = getSettings();
  const m = { ...cur, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) };
  db.prepare(`UPDATE settings SET notificationMode=?, senderEmail=?, senderPass=?, recipientEmail=?, scheduledTime=?, autoSendEnabled=?, lastSentAt=?, lastSentStatus=? WHERE id=1`)
    .run(m.notificationMode, m.senderEmail, m.senderPass, m.recipientEmail, m.scheduledTime, m.autoSendEnabled ? 1 : 0, m.lastSentAt, m.lastSentStatus);
  return getSettings();
}

// ---- backup / restore ----
function getBackup() {
  return { user: getUser(), settings: getSettings(), tasks: getAllTasks() };
}
function restoreBackup(data) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM tasks').run();
    updateUser(data.user);
    updateSettings(data.settings);
    (data.tasks || []).forEach(rawInsertTask);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---- recurrence + maintenance ----
function advanceDueDate(dueDate, recurrence) {
  const d = new Date(dueDate + 'T00:00:00');
  const today = new Date(getLocalDateStr() + 'T00:00:00');
  while (d < today) {
    if (recurrence === 'daily') d.setDate(d.getDate() + 1);
    else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
    else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
    else break;
  }
  return getLocalDateStr(d);
}

// Explicit upkeep, run at startup and once per cron minute (never on a plain read):
// hash a legacy plaintext password, and roll overdue recurring tasks forward.
function runMaintenance() {
  const user = getUser();
  if (user.password && !isHashed(user.password)) {
    updateUser({ password: hashPassword(user.password) });
  }

  const todayStr = getLocalDateStr();
  const overdue = db.prepare(
    "SELECT * FROM tasks WHERE trash = 0 AND recurrence != 'none' AND recurrence IS NOT NULL AND dueDate IS NOT NULL AND dueDate < ?"
  ).all(todayStr).map(rowToTask);
  overdue.forEach(t => {
    updateTask(t.id, { dueDate: advanceDueDate(t.dueDate, t.recurrence), done: false });
  });
}

module.exports = {
  getAllTasks, getTaskById, createTask, updateTask, deleteTaskById, emptyTrash, batchAction,
  getUser, updateUser, getSettings, updateSettings,
  getBackup, restoreBackup, runMaintenance
};
