import React from 'react';
import {
  LayoutGrid,
  Inbox,
  Sun,
  AlertTriangle,
  Clock,
  Star,
  Calendar,
  CalendarDays,
  BarChart2,
  CheckCircle2,
  Trash2
} from 'lucide-react';

export default function PulseSidebar({
  currentTab,
  onSelectTab,
  currentCategory,
  onSelectCategory,
  counts = {},
  categories = ['trabajo', 'personal', 'urgente', 'ideas', 'general'],
  isOpen,
  onClose,
  activeView,
  onChangeView
}) {

  const mainNavigation = [
    { id: 'matrix-view', label: 'Matriz 2x2 de Prioridades', icon: LayoutGrid, isMatrixViewBtn: true },
    { id: 'calendar-view', label: 'Vista de Calendario', icon: CalendarDays, view: 'calendar' },
    { id: 'stats-view', label: 'Métricas', icon: BarChart2, view: 'stats' },
    { id: 'inbox', label: 'Bandeja Principal', icon: Inbox, countKey: 'pending' },
    { id: 'today', label: 'Para Hoy', icon: Sun, countKey: 'today' },
    { id: 'overdue', label: 'Tareas Vencidas', icon: AlertTriangle, countKey: 'overdue', badgeColor: '#ef4444' },
    { id: 'week', label: 'Esta Semana', icon: Clock, countKey: 'week' },
    { id: 'starred', label: 'Destacadas', icon: Star, countKey: 'starred', badgeColor: '#f59e0b' },
    { id: 'scheduled', label: 'Programadas', icon: Calendar, countKey: 'scheduled' },
    { id: 'completed', label: 'Completadas', icon: CheckCircle2, countKey: 'completed' },
    { id: 'trash', label: 'Papelera', icon: Trash2, countKey: 'trash' }
  ];

  const getCategoryColor = (cat) => {
    switch (cat.toLowerCase()) {
      case 'trabajo': return '#3b82f6';
      case 'personal': return '#10b981';
      case 'urgente': return '#ef4444';
      case 'ideas': return '#f59e0b';
      default: return '#64748b';
    }
  };

  return (
    <>
      {/* Drawer Overlay for Mobile */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      <aside
        className={`app-sidebar ${isOpen ? 'open' : ''}`}
        aria-label="Navegación principal"
        style={{
          width: '240px',
          backgroundColor: 'var(--pulse-sidebar-bg)',
          borderRight: '1px solid var(--pulse-border)',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 64px)',
          overflowY: 'auto',
          padding: '16px 12px',
          gap: '24px',
          flexShrink: 0
        }}
      >
        {/* Main Navigation Views */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--pulse-text-muted)',
            padding: '0 12px 8px 12px',
            letterSpacing: '0.6px',
            textTransform: 'uppercase'
          }}>
            Vistas de Trabajo
          </span>

          {mainNavigation.map((item) => {
            const Icon = item.icon;
            const isSelected = item.isMatrixViewBtn
              ? activeView === 'matrix'
              : item.view
              ? activeView === item.view
              : (activeView === 'list' && currentTab === item.id);
            const count = item.countKey ? counts[item.countKey] || 0 : null;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.isMatrixViewBtn) {
                    onChangeView('matrix');
                  } else if (item.view) {
                    onChangeView(item.view);
                  } else {
                    onChangeView('list');
                    onSelectTab(item.id);
                  }
                  if (isOpen) onClose();
                }}
                aria-current={isSelected ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: isSelected ? '700' : '500',
                  color: isSelected ? 'var(--pulse-accent)' : 'var(--pulse-text-secondary)',
                  backgroundColor: isSelected ? 'var(--pulse-active-tab)' : 'transparent',
                  transition: 'all 0.15s ease',
                  border: 'none',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={17} color={isSelected ? 'var(--pulse-accent)' : item.badgeColor || 'var(--pulse-text-secondary)'} />
                  <span>{item.label}</span>
                </div>

                {count !== null && count > 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? 'var(--pulse-accent)' : 'var(--pulse-surface)',
                    color: isSelected ? '#ffffff' : 'var(--pulse-text-muted)',
                    border: '1px solid var(--pulse-border)'
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Categories Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px 8px 12px'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--pulse-text-muted)',
              letterSpacing: '0.6px',
              textTransform: 'uppercase'
            }}>
              Categorías
            </span>
            {currentCategory && (
              <button
                onClick={() => onSelectCategory('')}
                style={{
                  fontSize: '11px',
                  color: 'var(--pulse-accent)',
                  fontWeight: '600'
                }}
              >
                Limpiar
              </button>
            )}
          </div>

          {categories.map((cat) => {
            const isCatSelected = currentCategory.toLowerCase() === cat.toLowerCase();
            const color = getCategoryColor(cat);

            return (
              <button
                key={cat}
                onClick={() => {
                  onSelectCategory(isCatSelected ? '' : cat);
                  if (isOpen) onClose();
                }}
                aria-pressed={isCatSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: isCatSelected ? '700' : '500',
                  color: isCatSelected ? 'var(--pulse-text-primary)' : 'var(--pulse-text-secondary)',
                  backgroundColor: isCatSelected ? 'var(--pulse-surface)' : 'transparent',
                  border: isCatSelected ? '1px solid var(--pulse-border)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize'
                }}
              >
                <div style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  boxShadow: isCatSelected ? `0 0 8px ${color}` : 'none'
                }} />
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
