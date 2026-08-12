import React from 'react';
import { ListTodo, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react';
import { getEffectivePriority, filterByTab, dateStrDaysFromToday } from '../taskUtils';

// Marks reuse the app's established category/priority colors (the same hues the pills
// and badges use everywhere), so the dashboard reads as one system. Every bar is
// DIRECTLY LABELED with its name, so identity never rests on color alone — which is
// what keeps the red/green pair accessible for color-vision-deficient readers.
const CATEGORY_COLORS = { trabajo: '#1a73e8', personal: '#137333', urgente: '#d93025', ideas: '#f29900', general: '#5f6368' };
const PRIORITY_COLORS = { baja: '#5f6368', media: '#1a73e8', alta: '#f29900', urgente: '#d93025' };
const PRIORITY_ORDER = ['urgente', 'alta', 'media', 'baja'];
const PRIORITY_LABELS = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' };
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function Card({ children, style }) {
  return (
    <div style={{
      backgroundColor: 'var(--gmail-card-bg)',
      border: '1px solid var(--gmail-border)',
      borderRadius: '14px',
      padding: '18px 20px',
      ...style
    }}>
      {children}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }) {
  return (
    <Card style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--gmail-text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '12px', color: 'var(--gmail-text-muted)', marginTop: '4px' }}>{label}</div>
      </div>
    </Card>
  );
}

// Horizontal labeled bar: name on the left, colored fill, count on the right.
function BarRow({ name, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
      <span style={{ width: '78px', flexShrink: 0, color: 'var(--gmail-text-secondary)', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      <div style={{ flex: 1, height: '18px', backgroundColor: 'var(--gmail-hover)', borderRadius: '9px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(pct, value > 0 ? 6 : 0)}%`, height: '100%', backgroundColor: color, borderRadius: '9px', transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ width: '24px', textAlign: 'right', flexShrink: 0, fontWeight: '700', color: 'var(--gmail-text-primary)' }}>{value}</span>
    </div>
  );
}

export default function StatsDashboard({ tasks }) {
  const active = tasks.filter(t => !t.trash);
  const total = active.length;
  const completed = active.filter(t => t.done).length;
  const pending = active.filter(t => !t.done);
  const rate = total ? Math.round((completed / total) * 100) : 0;

  const overdue = filterByTab(active, 'overdue').length;
  const dueToday = filterByTab(active, 'today').length;
  const dueWeek = filterByTab(active, 'week').length;

  // Pending tasks grouped by category (largest first).
  const catCounts = {};
  pending.forEach(t => { const c = (t.category || 'general').toLowerCase(); catCounts[c] = (catCounts[c] || 0) + 1; });
  const catData = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(1, ...catData.map(d => d[1]));

  // Pending tasks grouped by EFFECTIVE priority (so deadline escalation is reflected).
  const priCounts = { baja: 0, media: 0, alta: 0, urgente: 0 };
  pending.forEach(t => { const p = getEffectivePriority(t); priCounts[p] = (priCounts[p] || 0) + 1; });
  const priData = PRIORITY_ORDER.map(p => [p, priCounts[p]]);
  const priMax = Math.max(1, ...priData.map(d => d[1]));

  // Pending tasks due on each of the next 7 days.
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = dateStrDaysFromToday(i);
    const count = pending.filter(t => t.dueDate === dateStr).length;
    const wd = new Date(dateStr + 'T00:00:00').getDay();
    days.push({ dateStr, label: i === 0 ? 'Hoy' : WEEKDAYS[wd], count });
  }
  const dayMax = Math.max(1, ...days.map(d => d.count));

  // Completion ring geometry.
  const R = 52, C = 2 * Math.PI * R;
  const ringColor = rate >= 66 ? '#1e8e3e' : rate >= 33 ? '#f29900' : '#d93025';

  if (total === 0) {
    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--gmail-text-muted)', textAlign: 'center' }}>
          <ListTodo size={48} color="#1a73e8" style={{ marginBottom: '12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '16px', fontWeight: '500', color: 'var(--gmail-text-primary)', margin: '0 0 6px 0' }}>Aún no hay estadísticas</h3>
          <p style={{ fontSize: '13px', margin: 0 }}>Crea algunas tareas y aquí verás tu progreso.</p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {/* Stat tiles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
        <StatTile icon={ListTodo} label="Pendientes" value={pending.length} color="#1a73e8" />
        <StatTile icon={CheckCircle2} label="Completadas" value={completed} color="#1e8e3e" />
        <StatTile icon={AlertTriangle} label="Vencidas" value={overdue} color="#d93025" />
        <StatTile icon={CalendarClock} label="Para hoy" value={dueToday} color="#f29900" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'stretch' }}>
        {/* Completion ring */}
        <Card style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'flex-start' }}>Cumplimiento</div>
          <svg width="130" height="130" viewBox="0 0 130 130" role="img" aria-label={`${rate}% de tareas completadas`}>
            <circle cx="65" cy="65" r={R} fill="none" stroke="var(--gmail-hover)" strokeWidth="12" />
            <circle
              cx="65" cy="65" r={R} fill="none" stroke={ringColor} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - rate / 100)}
              transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x="65" y="63" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--gmail-text-primary)">{rate}%</text>
            <text x="65" y="82" textAnchor="middle" fontSize="11" fill="var(--gmail-text-muted)">{completed}/{total}</text>
          </svg>
          <div style={{ fontSize: '12px', color: 'var(--gmail-text-muted)' }}>{dueWeek} vencen esta semana</div>
        </Card>

        {/* By category */}
        <Card style={{ flex: '2 1 300px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Pendientes por categoría</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {catData.length === 0
              ? <div style={{ fontSize: '13px', color: 'var(--gmail-text-muted)' }}>Sin pendientes 🎉</div>
              : catData.map(([name, value]) => (
                  <BarRow key={name} name={name} value={value} max={catMax} color={CATEGORY_COLORS[name] || '#5f6368'} />
                ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
        {/* By priority */}
        <Card style={{ flex: '1 1 300px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Pendientes por prioridad</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {priData.map(([name, value]) => (
              <BarRow key={name} name={PRIORITY_LABELS[name]} value={value} max={priMax} color={PRIORITY_COLORS[name]} />
            ))}
          </div>
        </Card>

        {/* Next 7 days */}
        <Card style={{ flex: '1 1 300px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Próximos 7 días</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
            {days.map(d => (
              <div key={d.dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%' }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${(d.count / dayMax) * 100}%`, minHeight: d.count > 0 ? '6px' : '0', backgroundColor: '#1a73e8', borderRadius: '5px 5px 0 0', transition: 'height 0.3s ease' }} title={`${d.count} tarea(s)`} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: d.count > 0 ? 'var(--gmail-text-primary)' : 'var(--gmail-text-muted)' }}>{d.count}</div>
                <div style={{ fontSize: '10px', color: 'var(--gmail-text-muted)' }}>{d.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }) {
  return (
    <main style={{
      flex: 1,
      backgroundColor: 'var(--gmail-surface)',
      margin: '16px 16px 16px 0',
      borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.02)',
      border: '1px solid var(--gmail-border)',
      overflowY: 'auto',
      padding: '20px'
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gmail-text-primary)', margin: '0 0 16px 0' }}>Estadísticas</h2>
      {children}
    </main>
  );
}
