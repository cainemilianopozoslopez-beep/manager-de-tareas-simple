const { test } = require('node:test');
const assert = require('node:assert');
const { filterByTab, filterByCategory, filterBySearch, filterTasks } = require('./taskFilters');
const { getLocalDateStr } = require('./dateUtils');

const future = '2099-01-01';
const tasks = [
  { id: 'a', title: 'Comprar café', description: 'para la oficina', category: 'personal', done: false, trash: false, starred: true, dueDate: getLocalDateStr() },
  { id: 'b', title: 'Enviar informe', description: 'KPIs', category: 'trabajo', done: true, trash: false, starred: false, dueDate: getLocalDateStr() },
  { id: 'c', title: 'Tarea futura', description: '', category: 'trabajo', done: false, trash: false, starred: false, dueDate: future },
  { id: 'd', title: 'Basura', description: '', category: 'ideas', done: false, trash: true, starred: false, dueDate: getLocalDateStr() },
];

test('filterByTab: pending excludes done and trashed', () => {
  assert.deepStrictEqual(filterByTab(tasks, 'pending').map(t => t.id), ['a', 'c']);
  assert.deepStrictEqual(filterByTab(tasks, 'inbox').map(t => t.id), ['a', 'c']);
});

test('filterByTab: completed / starred / trash', () => {
  assert.deepStrictEqual(filterByTab(tasks, 'completed').map(t => t.id), ['b']);
  assert.deepStrictEqual(filterByTab(tasks, 'starred').map(t => t.id), ['a']);
  assert.deepStrictEqual(filterByTab(tasks, 'trash').map(t => t.id), ['d']);
});

test('filterByTab: scheduled keeps only future, non-trashed, sorted by date', () => {
  const ids = filterByTab(tasks, 'scheduled').map(t => t.id);
  assert.deepStrictEqual(ids, ['c']);
});

test('filterByCategory is case-insensitive and no-ops on empty', () => {
  assert.deepStrictEqual(filterByCategory(tasks, 'TRABAJO').map(t => t.id), ['b', 'c']);
  assert.strictEqual(filterByCategory(tasks, '').length, tasks.length);
});

test('filterBySearch matches title and description, case-insensitive', () => {
  assert.deepStrictEqual(filterBySearch(tasks, 'café').map(t => t.id), ['a']);
  assert.deepStrictEqual(filterBySearch(tasks, 'kpis').map(t => t.id), ['b']);
});

test('filterTasks composes tab + category + search', () => {
  const res = filterTasks(tasks, { filter: 'pending', category: 'trabajo', search: 'futura' });
  assert.deepStrictEqual(res.map(t => t.id), ['c']);
});

test('smart views: today / overdue / week bucket by due date', () => {
  const today = getLocalDateStr();
  const overdueDate = '2000-01-01';
  const inWeek = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 3); return getLocalDateStr(d); })();
  const afterWeek = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 30); return getLocalDateStr(d); })();
  const smart = [
    { id: 'today', title: 'hoy', done: false, trash: false, dueDate: today },
    { id: 'late', title: 'vencida', done: false, trash: false, dueDate: overdueDate },
    { id: 'soon', title: 'pronto', done: false, trash: false, dueDate: inWeek },
    { id: 'far', title: 'lejos', done: false, trash: false, dueDate: afterWeek },
    { id: 'donetoday', title: 'hecha', done: true, trash: false, dueDate: today },
  ];
  assert.deepStrictEqual(filterByTab(smart, 'today').map(t => t.id), ['today']);
  assert.deepStrictEqual(filterByTab(smart, 'overdue').map(t => t.id), ['late']);
  // week window includes today through +6 days: today + soon (inWeek=+3), not far, not done
  assert.deepStrictEqual(filterByTab(smart, 'week').map(t => t.id), ['today', 'soon']);
});
