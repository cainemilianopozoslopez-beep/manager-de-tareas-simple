import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTodayStr } from '../taskUtils';

const CATEGORY_COLORS = { trabajo: '#1a73e8', personal: '#137333', urgente: '#d93025', ideas: '#f29900', general: '#5f6368' };
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MAX_CHIPS = 3;

export default function CalendarView({ tasks, onEdit, onCompose }) {
  const todayStr = getTodayStr();
  const [cursor, setCursor] = useState(() => {
    const d = new Date(todayStr + 'T00:00:00');
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  // Which day's "+N más" overflow popover is open (at most one at a time).
  const [expandedDay, setExpandedDay] = useState(null);

  // Bucket non-trashed, dated tasks by their due date.
  const byDate = {};
  tasks.forEach(t => {
    if (t.trash || !t.dueDate) return;
    (byDate[t.dueDate] = byDate[t.dueDate] || []).push(t);
  });
  Object.values(byDate).forEach(list => list.sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || '')));

  const first = new Date(cursor.y, cursor.m, 1);
  const startWeekday = first.getDay();
  // Capitalize only the first letter ("Agosto de 2026"), not every word.
  const rawMonth = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const monthLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);

  // 6 weeks × 7 days grid; cells outside the month are dimmed.
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(cursor.y, cursor.m, i - startWeekday + 1);
    cells.push({ date, dateStr: getTodayStr(date), inMonth: date.getMonth() === cursor.m });
  }

  const shiftMonth = (delta) => setCursor(c => {
    const d = new Date(c.y, c.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const goToday = () => { const d = new Date(todayStr + 'T00:00:00'); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };

  const btnStyle = { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '14px', fontSize: '13px', fontWeight: '600', color: 'var(--gmail-text-secondary)', border: '1px solid var(--gmail-border)' };

  return (
    <main style={{
      flex: 1,
      backgroundColor: 'var(--gmail-surface)',
      margin: '16px 16px 16px 0',
      borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.02)',
      border: '1px solid var(--gmail-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--gmail-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => shiftMonth(-1)} title="Mes anterior" aria-label="Mes anterior" style={{ padding: '6px', borderRadius: '50%', display: 'flex', color: 'var(--gmail-text-secondary)' }}><ChevronLeft size={18} /></button>
          <span className="calendar-toolbar-month" style={{ fontSize: '15px', fontWeight: '700', color: 'var(--gmail-text-primary)', minWidth: '150px', textAlign: 'center' }}>{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} title="Mes siguiente" aria-label="Mes siguiente" style={{ padding: '6px', borderRadius: '50%', display: 'flex', color: 'var(--gmail-text-secondary)' }}><ChevronRight size={18} /></button>
        </div>
        <button onClick={goToday} style={btnStyle}>Hoy</button>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--gmail-border)' }}>
        {WEEKDAYS.map(w => (
          <div key={w} className="calendar-weekday-header" style={{ padding: '8px 0', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', overflowY: 'auto' }}>
        {cells.map((cell, idx) => {
          const dayTasks = byDate[cell.dateStr] || [];
          const isToday = cell.dateStr === todayStr;
          return (
            <div
              key={idx}
              className="calendar-cell"
              onClick={() => {
                setExpandedDay(null);
                onCompose?.(cell.dateStr);
              }}
              title="Clic para crear una tarea en este día"
              style={{
                minWidth: 0,
                position: 'relative',
                borderRight: (idx % 7 !== 6) ? '1px solid var(--gmail-border)' : 'none',
                borderBottom: '1px solid var(--gmail-border)',
                minHeight: '92px',
                padding: '4px 5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                cursor: 'pointer',
                backgroundColor: cell.inMonth ? 'transparent' : 'var(--gmail-bg)',
                opacity: cell.inMonth ? 1 : 0.55
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span className="calendar-day-num" style={{
                  fontSize: '12px',
                  fontWeight: isToday ? '700' : '500',
                  color: isToday ? '#ffffff' : 'var(--gmail-text-secondary)',
                  backgroundColor: isToday ? 'var(--pulse-accent, #1a73e8)' : 'transparent',
                  borderRadius: '50%',
                  width: '22px', height: '22px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{cell.date.getDate()}</span>
              </div>

              {dayTasks.slice(0, MAX_CHIPS).map(t => (
                <button
                  key={t.id}
                  className="calendar-task-chip"
                  onClick={(e) => { e.stopPropagation(); onEdit?.(t); }}
                  title={t.title}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    width: '100%', textAlign: 'left',
                    padding: '2px 5px', borderRadius: '5px',
                    fontSize: '11px', color: 'var(--gmail-text-primary)',
                    backgroundColor: 'var(--gmail-hover)',
                    textDecoration: t.done ? 'line-through' : 'none',
                    opacity: t.done ? 0.6 : 1,
                    overflow: 'hidden', whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, backgroundColor: CATEGORY_COLORS[(t.category || 'general').toLowerCase()] || '#5f6368' }} />
                  <span className="calendar-task-chip-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.dueTime ? `${t.dueTime} ` : ''}{t.title}</span>
                </button>
              ))}

              {dayTasks.length > MAX_CHIPS && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDay(prev => (prev === cell.dateStr ? null : cell.dateStr));
                  }}
                  style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: 'var(--pulse-accent, #1a73e8)',
                    padding: '0 0 0 5px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  +{dayTasks.length - MAX_CHIPS} más
                </button>
              )}

              {expandedDay === cell.dateStr && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'var(--gmail-modal-bg)',
                    border: '1px solid var(--gmail-border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    padding: '6px',
                    zIndex: 20,
                    minWidth: '190px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  {dayTasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setExpandedDay(null); onEdit?.(t); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        textAlign: 'left',
                        fontSize: '11.5px',
                        color: 'var(--gmail-text-primary)',
                        padding: '5px 8px',
                        borderRadius: '5px',
                        textDecoration: t.done ? 'line-through' : 'none',
                        opacity: t.done ? 0.6 : 1
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, backgroundColor: CATEGORY_COLORS[(t.category || 'general').toLowerCase()] || '#5f6368' }} />
                      {t.dueTime ? `${t.dueTime} ` : ''}{t.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
