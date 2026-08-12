// Client-side task helpers: recurrence rolling + filtering.
//
// These mirror the server (server/db.js for recurrence, server/taskFilters.js for
// filtering). The two runtimes can't share one module (ESM client vs CommonJS
// server, separate packages), so the contract is kept identical by convention:
// if you change semantics here, change the server side to match.

// Local calendar date 'YYYY-MM-DD' (NOT UTC). Mirrors server/dateUtils.js — using
// toISOString() here made "today" flip at a non-midnight local hour in any timezone
// offset from UTC (e.g. 18:00 local at UTC-6), throwing off due-today, recurrence,
// and the scheduled filter.
export const getTodayStr = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ---- Recurrence (guest mode only; registered users are advanced server-side) ----

// Rolls a recurring task's dueDate forward (daily/weekly/monthly) until it lands on
// today or later.
export function advanceDueDate(dueDate, recurrence) {
  const d = new Date(dueDate + 'T00:00:00');
  const today = new Date(getTodayStr() + 'T00:00:00');
  while (d < today) {
    if (recurrence === 'daily') d.setDate(d.getDate() + 1);
    else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
    else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
    else break;
  }
  return getTodayStr(d);
}

// Returns a new list with overdue recurring tasks rolled forward (done reset), or the
// SAME reference when nothing changed — callers rely on the identity check to avoid
// redundant state updates.
export function advanceRecurringTasks(list) {
  const todayStr = getTodayStr();
  let changed = false;
  const advanced = list.map(t => {
    if (t.trash || !t.recurrence || t.recurrence === 'none' || !t.dueDate || t.dueDate >= todayStr) return t;
    changed = true;
    return { ...t, dueDate: advanceDueDate(t.dueDate, t.recurrence), done: false, updatedAt: new Date().toISOString() };
  });
  return changed ? advanced : list;
}

// ---- Filtering (mirrors server/taskFilters.js) ----

// Local calendar date N days from today, as 'YYYY-MM-DD'.
export function dateStrDaysFromToday(days) {
  const d = new Date(getTodayStr() + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return getTodayStr(d);
}

const byDueDateAsc = (a, b) =>
  (a.dueDate + (a.dueTime || '')).localeCompare(b.dueDate + (b.dueTime || ''));

export function filterByTab(tasks, tab) {
  if (tab === 'pending' || tab === 'inbox') {
    return tasks.filter(t => !t.done && !t.trash);
  }
  if (tab === 'completed') {
    return tasks.filter(t => t.done && !t.trash);
  }
  if (tab === 'starred') {
    return tasks.filter(t => t.starred && !t.trash);
  }
  if (tab === 'trash') {
    return tasks.filter(t => t.trash);
  }
  if (tab === 'scheduled') {
    const todayStr = getTodayStr();
    return tasks
      .filter(t => !t.trash && t.dueDate && t.dueDate > todayStr)
      .sort(byDueDateAsc);
  }
  // Smart views: pending, non-trashed tasks bucketed by how their due date relates to today.
  if (tab === 'today') {
    const todayStr = getTodayStr();
    return tasks
      .filter(t => !t.done && !t.trash && t.dueDate === todayStr)
      .sort(byDueDateAsc);
  }
  if (tab === 'week') {
    const todayStr = getTodayStr();
    const weekEnd = dateStrDaysFromToday(6); // today + the next 6 days = a 7-day window
    return tasks
      .filter(t => !t.done && !t.trash && t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEnd)
      .sort(byDueDateAsc);
  }
  if (tab === 'overdue') {
    const todayStr = getTodayStr();
    return tasks
      .filter(t => !t.done && !t.trash && t.dueDate && t.dueDate < todayStr)
      .sort(byDueDateAsc);
  }
  // fallback for unrecognized tab values: everything not trashed
  return tasks.filter(t => !t.trash);
}

export function filterByCategory(tasks, category) {
  if (!category) return tasks;
  const c = category.toLowerCase();
  return tasks.filter(t => t.category && t.category.toLowerCase() === c);
}

export function filterBySearch(tasks, search) {
  if (!search) return tasks;
  const q = search.toLowerCase();
  return tasks.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.description && t.description.toLowerCase().includes(q))
  );
}

export function filterTasks(tasks, { tab, category, search } = {}) {
  return filterBySearch(filterByCategory(filterByTab(tasks, tab), category), search);
}

// ---- Priority (mirrors server/mailer.js getEffectivePriority) ----

export const PRIORITY_RANK = { baja: 0, media: 1, alta: 2, urgente: 3 };
const RANK_TO_PRIORITY = ['baja', 'media', 'alta', 'urgente'];

// Priority only ever escalates upward as the deadline (dueDate) closes in — it never
// lowers whatever the user picked, and it's purely a display computation: the stored
// task.priority is left untouched.
export function getEffectivePriority(task) {
  if (task.done || task.trash || !task.dueDate) return task.priority || 'media';

  const diffDays = Math.round(
    (new Date(task.dueDate + 'T00:00:00') - new Date(getTodayStr() + 'T00:00:00')) / 86400000
  );

  let floor = null;
  if (diffDays <= 0) floor = 'urgente';
  else if (diffDays === 1) floor = 'alta';
  else if (diffDays <= 3) floor = 'media';

  if (!floor) return task.priority || 'media';

  const currentRank = PRIORITY_RANK[task.priority] ?? PRIORITY_RANK.media;
  return RANK_TO_PRIORITY[Math.max(currentRank, PRIORITY_RANK[floor])];
}

// Default list ordering: most urgent first (by effective priority), then soonest
// deadline, then earliest time. Tasks without a due date sort last. Stable for ties.
export function compareTasksByUrgency(a, b) {
  const pa = PRIORITY_RANK[getEffectivePriority(a)] ?? PRIORITY_RANK.media;
  const pb = PRIORITY_RANK[getEffectivePriority(b)] ?? PRIORITY_RANK.media;
  if (pa !== pb) return pb - pa;

  const da = a.dueDate || '9999-12-31';
  const db = b.dueDate || '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;

  const ta = a.dueTime || '99:99';
  const tb = b.dueTime || '99:99';
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

// ---- Eisenhower Matrix Quadrant Categorization ----
// Q1: Urgent & Important (Hacer Ya) - High importance (urgente/alta/starred) AND urgent date (today/tomorrow/overdue)
// Q2: Important, Not Urgent (Planificar) - High importance with far future due date
// Q3: Urgent, Not Important (Delegar / Rápido) - Low/medium importance with urgent due date
// Q4: Neither Urgent nor Important (Revisar) - Low/medium importance with far future or no due date
export function getEisenhowerQuadrant(task) {
  const isHighImportance = task.starred || task.priority === 'urgente' || task.priority === 'alta';
  const isUrgent = Boolean(task.dueDate && task.dueDate <= dateStrDaysFromToday(1));

  if (isHighImportance && isUrgent) {
    return 'q1';
  } else if (isHighImportance && !isUrgent) {
    return 'q2';
  } else if (!isHighImportance && isUrgent) {
    return 'q3';
  } else {
    return 'q4';
  }
}


