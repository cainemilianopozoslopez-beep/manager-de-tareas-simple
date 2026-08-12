// Local calendar date as 'YYYY-MM-DD'. Uses the machine's local timezone, NOT UTC.
//
// Why this matters: due dates are local calendar days, and the cron/summary logic
// compares against local wall-clock time (getHours()). Deriving "today" from
// toISOString() (which is UTC) made the date flip at a non-midnight local hour in any
// timezone offset from UTC — e.g. at UTC-6 "today" rolled over at 18:00 local. Every
// place that needs today's (or a Date's) calendar day must go through here.
function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { getLocalDateStr };
