const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Point db.js at a throwaway database BEFORE requiring it (it initializes on import).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtm-db-test-'));
process.env.GTM_DB_PATH = path.join(tmpDir, 'test.db');

const db = require('./db');

after(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('seeds a default user and settings on a fresh database', () => {
  const user = db.getUser();
  assert.strictEqual(user.username, 'Caín');
  const settings = db.getSettings();
  assert.strictEqual(settings.scheduledTime, '08:00');
  assert.strictEqual(typeof settings.autoSendEnabled, 'boolean');
});

test('createTask round-trips fields and subtasks', () => {
  const t = db.createTask({ title: 'Prueba', category: 'trabajo', priority: 'alta', dueDate: '2026-08-20', subtasks: [{ id: 's1', text: 'a', done: true }] });
  assert.ok(t.id.startsWith('task-'));
  const fetched = db.getTaskById(t.id);
  assert.strictEqual(fetched.title, 'Prueba');
  assert.strictEqual(fetched.priority, 'alta');
  assert.deepStrictEqual(fetched.subtasks, [{ id: 's1', text: 'a', done: true }]);
  assert.strictEqual(fetched.done, false);
  assert.strictEqual(fetched.starred, false);
});

test('updateTask changes only the provided fields', () => {
  const t = db.createTask({ title: 'Editar', category: 'personal' });
  const updated = db.updateTask(t.id, { done: true });
  assert.strictEqual(updated.done, true);
  assert.strictEqual(updated.title, 'Editar');       // untouched
  assert.strictEqual(updated.category, 'personal');  // untouched
});

test('delete moves to trash then removes permanently', () => {
  const t = db.createTask({ title: 'Borrar' });
  db.updateTask(t.id, { trash: true });
  assert.strictEqual(db.getTaskById(t.id).trash, true);
  db.deleteTaskById(t.id);
  assert.strictEqual(db.getTaskById(t.id), null);
});

test('batchAction applies one action to many ids atomically', () => {
  const a = db.createTask({ title: 'A' });
  const b = db.createTask({ title: 'B' });
  const affected = db.batchAction([a.id, b.id], 'done');
  assert.strictEqual(affected, 2);
  assert.strictEqual(db.getTaskById(a.id).done, true);
  assert.strictEqual(db.getTaskById(b.id).done, true);

  const del = db.batchAction([a.id, b.id], 'delete');
  assert.strictEqual(del, 2);
  assert.strictEqual(db.getTaskById(a.id), null);
});

test('emptyTrash removes only trashed tasks', () => {
  const keep = db.createTask({ title: 'Quedarse' });
  const gone = db.createTask({ title: 'Irse' });
  db.updateTask(gone.id, { trash: true });
  db.emptyTrash();
  assert.strictEqual(db.getTaskById(gone.id), null);
  assert.ok(db.getTaskById(keep.id));
});

test('backup export/restore replaces all data', () => {
  const backup = { user: { username: 'Nuevo', password: '0000', theme: 'dark' }, settings: db.getSettings(), tasks: [{ id: 'task-x', title: 'Restaurada', done: false, trash: false, subtasks: [] }] };
  db.restoreBackup(backup);
  assert.strictEqual(db.getUser().username, 'Nuevo');
  const all = db.getAllTasks();
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].title, 'Restaurada');
});
