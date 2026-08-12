import React from 'react';
import { Plus, Inbox, Star, Clock, CheckCircle, Trash2, Tag, Briefcase, User, AlertCircle, Lightbulb, Folder, CalendarCheck, CalendarRange, AlertTriangle, CalendarDays, BarChart3 } from 'lucide-react';

const CATEGORY_META = {
  '': { label: 'Todas las categorías', icon: Folder, color: '#5f6368' },
  trabajo: { label: 'Trabajo', icon: Briefcase, color: '#1a73e8' },
  personal: { label: 'Personal', icon: User, color: '#137333' },
  urgente: { label: 'Urgente', icon: AlertCircle, color: '#d93025' },
  ideas: { label: 'Ideas', icon: Lightbulb, color: '#f29900' },
  general: { label: 'General', icon: Folder, color: '#5f6368' }
};

const getCategoryMeta = (id) => CATEGORY_META[id] || {
  label: id.charAt(0).toUpperCase() + id.slice(1),
  icon: Tag,
  color: '#5f6368'
};

export default function Sidebar({
  currentTab,
  setCurrentTab,
  currentCategory,
  setCurrentCategory,
  counts,
  categories = [],
  isOpen,
  onClose,
  onOpenCompose
}) {

  const mainNavItems = [
    { id: 'inbox', label: 'Pendientes (Recibidos)', icon: Inbox, count: counts.pending, color: '#1a73e8' },
    { id: 'today', label: 'Hoy', icon: CalendarCheck, count: counts.today, color: '#1a73e8' },
    { id: 'overdue', label: 'Vencidas', icon: AlertTriangle, count: counts.overdue, color: '#d93025' },
    { id: 'week', label: 'Esta semana', icon: CalendarRange, count: counts.week, color: '#137333' },
    { id: 'starred', label: 'Destacadas', icon: Star, count: counts.starred, color: '#f29900' },
    { id: 'scheduled', label: 'Programadas', icon: Clock, count: counts.scheduled, color: '#137333' },
    { id: 'completed', label: 'Completadas', icon: CheckCircle, count: counts.completed, color: '#1e8e3e' },
    { id: 'trash', label: 'Papelera', icon: Trash2, count: counts.trash, color: '#d93025' },
    // Tool views (not task filters, so no count badge).
    { id: 'calendar', label: 'Calendario', icon: CalendarDays, color: '#1a73e8' },
    { id: 'stats', label: 'Estadísticas', icon: BarChart3, color: '#1e8e3e' }
  ];

  const categoryItems = ['', ...categories].map(id => ({ id, ...getCategoryMeta(id) }));

  return (
    <>
      {/* Backdrop (mobile only, closes the drawer on tap outside) */}
      <div
        className={`sidebar-backdrop${isOpen ? ' open' : ''}`}
        onClick={onClose}
      />

      <aside className={`app-sidebar${isOpen ? ' open' : ''}`} style={{
        width: '256px',
        backgroundColor: 'var(--gmail-sidebar-bg)',
        height: 'calc(100vh - 64px)',
        padding: '16px 12px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        userSelect: 'none',
        borderRight: '1px solid var(--gmail-border)',
        overflowY: 'auto'
      }}>

        {/* Gmail Compose FAB Button */}
        <button
          onClick={onOpenCompose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--gmail-compose-bg)',
            color: 'var(--gmail-active-text)',
            padding: '16px 24px',
            borderRadius: '16px',
            fontSize: '15px',
            fontWeight: '600',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease',
            width: 'fit-content',
            marginBottom: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--gmail-compose-hover)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--gmail-compose-bg)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.05)';
          }}
        >
          <Plus size={24} color="#001d35" />
          <span>Redactar tarea</span>
        </button>

        {/* Main Navigation List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {mainNavItems.map(item => {
            const IconComponent = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  onClose?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 16px 0 24px',
                  height: '36px',
                  borderRadius: '0 18px 18px 0',
                  fontSize: '14px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? 'var(--gmail-active-text)' : 'var(--gmail-text-secondary)',
                  backgroundColor: isActive ? 'var(--gmail-active-tab)' : 'transparent',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--gmail-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <IconComponent size={18} color={isActive ? item.color : '#5f6368'} />
                  <span>{item.label}</span>
                </div>
                {item.count > 0 && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: isActive ? item.color : '#5f6368'
                  }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <hr style={{ border: 'none', borderTop: '1px solid var(--gmail-border)', margin: '8px 0' }} />

        {/* Categories / Labels */}
        <div>
          <div style={{
            padding: '0 24px',
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--gmail-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: '8px'
          }}>
            Etiquetas / Categorías
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {categoryItems.map(cat => {
              const IconComp = cat.icon;
              const isCatActive = currentCategory === cat.id;

              return (
                <button
                  key={cat.id || 'all'}
                  onClick={() => {
                    setCurrentCategory(cat.id);
                    onClose?.();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '0 16px 0 24px',
                    height: '34px',
                    borderRadius: '0 17px 17px 0',
                    fontSize: '13.5px',
                    fontWeight: isCatActive ? '700' : '400',
                    color: isCatActive ? 'var(--gmail-active-text)' : 'var(--gmail-text-secondary)',
                    backgroundColor: isCatActive ? 'var(--gmail-active-tab)' : 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCatActive) e.currentTarget.style.backgroundColor = 'var(--gmail-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCatActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <IconComp size={16} color={cat.color} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </aside>
    </>
  );
}
