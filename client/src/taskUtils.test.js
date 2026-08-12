import { test } from 'node:test';
import assert from 'node:assert';
import {
  getTodayStr,
  advanceDueDate,
  advanceRecurringTasks,
  filterByTab,
  filterTasks,
  getEffectivePriority,
  compareTasksByUrgency,
  getEisenhowerQuadrant
} from './taskUtils.js';

test('getTodayStr returns local YYYY-MM-DD', () => {
  const s = getTodayStr(new Date('2026-08-07T23:30:00'));
  assert.match(s, /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(s, '2026-08-07');
});

test('advanceDueDate rolls a past daily task forward to today or later', () => {
  const today = getTodayStr();
  const out = advanceDueDate('2000-01-01', 'daily');
  assert.ok(out >= today, `${out} should be >= ${today}`);
});

test('advanceDueDate leaves a non-recurring past date unchanged', () => {
  assert.strictEqual(advanceDueDate('2000-01-01', 'none'), '2000-01-01');
});

test('advanceRecurringTasks returns the SAME reference when nothing changes', () => {
  const list = [{ id: '1', recurrence: 'none', dueDate: '2000-01-01', trash: false }];
  assert.strictEqual(advanceRecurringTasks(list), list);
});

test('advanceRecurringTasks advances overdue recurring tasks and resets done', () => {
  const list = [{ id: '1', recurrence: 'daily', dueDate: '2000-01-01', done: true, trash: false }];
  const out = advanceRecurringTasks(list);
  assert.notStrictEqual(out, list);
  assert.ok(out[0].dueDate >= getTodayStr());
  assert.strictEqual(out[0].done, false);
});

test('getEffectivePriority escalates as the deadline nears but never lowers', () => {
  const today = getTodayStr();
  // Due today with a low stored priority -> escalates to urgente.
  assert.strictEqual(getEffectivePriority({ priority: 'baja', dueDate: today }), 'urgente');
  // Done tasks are never escalated.
  assert.strictEqual(getEffectivePriority({ priority: 'baja', dueDate: today, done: true }), 'baja');
  // Far future keeps the stored priority.
  assert.strictEqual(getEffectivePriority({ priority: 'media', dueDate: '2099-01-01' }), 'media');
});

test('compareTasksByUrgency orders most-urgent first', () => {
  const today = getTodayStr();
  const tasks = [
    { id: 'baja', priority: 'baja', dueDate: '2099-01-01' },
    { id: 'urgente', priority: 'urgente', dueDate: today },
    { id: 'media', priority: 'media', dueDate: '2099-06-01' },
  ];
  const ids = [...tasks].sort(compareTasksByUrgency).map(t => t.id);
  assert.strictEqual(ids[0], 'urgente');
  assert.strictEqual(ids[ids.length - 1], 'baja');
});

test('filterTasks composes tab + category + search on the client', () => {
  const tasks = [
    { id: 'a', title: 'Comprar café', description: '', category: 'personal', done: false, trash: false },
    { id: 'b', title: 'Informe', description: 'kpi', category: 'trabajo', done: false, trash: false },
  ];
  assert.deepStrictEqual(filterByTab(tasks, 'pending').map(t => t.id), ['a', 'b']);
  assert.deepStrictEqual(filterTasks(tasks, { tab: 'pending', category: 'trabajo' }).map(t => t.id), ['b']);
});

test('getEisenhowerQuadrant categorizes tasks into Q1, Q2, Q3, Q4 correctly', () => {
  const today = getTodayStr();
  assert.strictEqual(getEisenhowerQuadrant({ priority: 'urgente', dueDate: today }), 'q1');
  assert.strictEqual(getEisenhowerQuadrant({ priority: 'alta', dueDate: '2099-12-31' }), 'q2');
  assert.strictEqual(getEisenhowerQuadrant({ priority: 'media', dueDate: today }), 'q3');
  assert.strictEqual(getEisenhowerQuadrant({ priority: 'baja', dueDate: '2099-12-31' }), 'q4');
});

