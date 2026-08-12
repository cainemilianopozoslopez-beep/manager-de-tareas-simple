// Single source of truth for server-side task filtering (tab + category + search).
// Mirrors client/src/taskUtils.js — if you change filter semantics here, change it
// there too. Keeping both in sync is why this logic lives in one function per side
// instead of being inlined at each call site.

const { getLocalDateStr } = require('./dateUtils');

// Local calendar date N days from today, as 'YYYY-MM-DD'.
function dateStrDaysFromToday(days) {
  const d = new Date(getLocalDateStr() + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return getLocalDateStr(d);
}

const byDueDateAsc = (a, b) =>
  (a.dueDate + (a.dueTime || '')).localeCompare(b.dueDate + (b.dueTime || ''));

function filterByTab(tasks, filter) {
  if (filter === 'pending' || filter === 'inbox') {
    return tasks.filter(t => !t.done && !t.trash);
  }
  if (filter === 'completed') {
    return tasks.filter(t => t.done && !t.trash);
  }
  if (filter === 'starred') {
    return tasks.filter(t => t.starred && !t.trash);
  }
  if (filter === 'trash') {
    return tasks.filter(t => t.trash);
  }
  if (filter === 'scheduled') {
    const todayStr = getLocalDateStr();
    return tasks
      .filter(t => !t.trash && t.dueDate && t.dueDate > todayStr)
      .sort(byDueDateAsc);
  }
  // Smart views: pending, non-trashed tasks bucketed by how their due date relates to today.
  if (filter === 'today') {
    const todayStr = getLocalDateStr();
    return tasks
      .filter(t => !t.done && !t.trash && t.dueDate === todayStr)
      .sort(byDueDateAsc);
  }
  if (filter === 'week') {
    const todayStr = getLocalDateStr();
    const weekEnd = dateStrDaysFromToday(6); // today + the next 6 days = a 7-day window
    return tasks
      .filter(t => !t.done && !t.trash && t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEnd)
      .sort(byDueDateAsc);
  }
  if (filter === 'overdue') {
    const todayStr = getLocalDateStr();
    return tasks
      .filter(t => !t.done && !t.trash && t.dueDate && t.dueDate < todayStr)
      .sort(byDueDateAsc);
  }
  if (filter === 'all') {
    return tasks.slice();
  }
  // fallback for unrecognized filter values: everything not trashed
  return tasks.filter(t => !t.trash);
}

function filterByCategory(tasks, category) {
  if (!category) return tasks;
  const c = category.toLowerCase();
  return tasks.filter(t => t.category && t.category.toLowerCase() === c);
}

function filterBySearch(tasks, search) {
  if (!search) return tasks;
  const q = search.toLowerCase();
  return tasks.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.description && t.description.toLowerCase().includes(q))
  );
}

function filterTasks(tasks, { filter, category, search } = {}) {
  return filterBySearch(filterByCategory(filterByTab(tasks, filter), category), search);
}

module.exports = {
  filterByTab,
  filterByCategory,
  filterBySearch,
  filterTasks
};
