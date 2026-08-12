import React from 'react';
import TaskItem from './TaskItem';
import { RotateCw, Trash2, Inbox, CheckCircle2, X, CheckSquare, Square, RotateCcw, Tag } from 'lucide-react';
import { compareTasksByUrgency } from '../taskUtils';

function BulkBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '5px 12px',
        borderRadius: '14px',
        fontSize: '12.5px',
        fontWeight: '600',
        backgroundColor: 'var(--gmail-surface)',
        color: danger ? '#d93025' : 'var(--gmail-text-primary)',
        border: '1px solid var(--gmail-border)'
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

export default function TaskList({
  tasks,
  loading,
  currentTab,
  onRefresh,
  onToggleDone,
  onToggleStar,
  onEdit,
  onDelete,
  onEmptyTrash,
  onToggleSubtask,
  currentCategory,
  searchQuery,
  onClearCategory,
  onClearSearch,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectMany,
  onClearSelection,
  onBulkAction,
  categories = []
}) {

  // Order most-urgent-first by default. Date-oriented views (scheduled/week/overdue/today)
  // keep the server's chronological order — they're about *when*, not priority; every
  // other tab surfaces the tasks that need attention soonest at the top.
  const CHRONOLOGICAL_TABS = ['scheduled', 'week', 'overdue', 'today'];
  const displayTasks = CHRONOLOGICAL_TABS.includes(currentTab)
    ? tasks
    : [...tasks].sort(compareTasksByUrgency);

  const selectionCount = displayTasks.filter(t => selectedIds.has(t.id)).length;
  const allSelected = displayTasks.length > 0 && selectionCount === displayTasks.length;
  const toggleSelectAll = () => (allSelected ? onClearSelection() : onSelectMany(displayTasks.map(t => t.id)));
  const isTrashTab = currentTab === 'trash';

  const getTabTitle = () => {
    switch (currentTab) {
      case 'inbox': return 'Bandeja de Entrada - Tareas Pendientes';
      case 'today': return 'Para Hoy';
      case 'overdue': return 'Tareas Vencidas';
      case 'week': return 'Esta Semana';
      case 'starred': return 'Tareas Destacadas';
      case 'scheduled': return 'Tareas Programadas';
      case 'completed': return 'Tareas Completadas (Listas para borrar)';
      case 'trash': return 'Papelera de Tareas';
      default: return 'Todas las Tareas';
    }
  };

  return (
    <main style={{
      flex: 1,
      backgroundColor: 'var(--pulse-surface)',
      margin: '16px',
      borderRadius: '16px',
      boxShadow: 'var(--pulse-shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid var(--pulse-border)'
    }}>

      {/* Pulse List Toolbar Header */}
      <div style={{
        minHeight: '48px',
        padding: '12px 18px',
        borderBottom: '1px solid var(--pulse-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        backgroundColor: 'var(--pulse-surface)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', rowGap: '6px' }}>
          {displayTasks.length > 0 && (
            <button
              onClick={toggleSelectAll}
              title={allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
              aria-label={allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
              style={{ padding: '4px', display: 'flex', color: selectionCount > 0 ? 'var(--gmail-blue)' : 'var(--gmail-text-muted)' }}
            >
              {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>
          )}
          <button
            onClick={onRefresh}
            title="Actualizar lista de tareas"
            style={{ padding: '6px', borderRadius: '50%', color: 'var(--gmail-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gmail-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <RotateCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>

          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gmail-text-primary)' }}>
            {getTabTitle()}
          </span>

          <span style={{
            fontSize: '12px',
            backgroundColor: 'var(--gmail-active-tab)',
            color: 'var(--gmail-active-text)',
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: '600'
          }}>
            {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
          </span>

          {/* Active filter chips: without these, a lingering category/search filter
              silently hides tasks with no visible explanation (bit us twice already). */}
          {currentCategory && (
            <button
              onClick={onClearCategory}
              title="Quitar filtro de categoría"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--gmail-hover)',
                color: 'var(--gmail-text-primary)',
                padding: '3px 8px 3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid var(--gmail-border)',
                textTransform: 'capitalize'
              }}
            >
              Categoría: {currentCategory}
              <X size={12} />
            </button>
          )}

          {searchQuery && (
            <button
              onClick={onClearSearch}
              title="Quitar búsqueda"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--gmail-hover)',
                color: 'var(--gmail-text-primary)',
                padding: '3px 8px 3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid var(--gmail-border)'
              }}
            >
              "{searchQuery}"
              <X size={12} />
            </button>
          )}
        </div>

        {currentTab === 'trash' && tasks.length > 0 && (
          <button
            onClick={onEmptyTrash}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#fce8e6',
              color: '#c5221f',
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '12.5px',
              fontWeight: '600'
            }}
          >
            <Trash2 size={15} />
            <span>Vaciar Papelera</span>
          </button>
        )}
      </div>

      {/* Bulk-action bar: only while something is selected. Actions depend on the tab
          (trash offers restore / delete-forever; every other view offers complete /
          move-to-trash / change-category). */}
      {selectionCount > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '8px 16px',
          borderBottom: '1px solid var(--gmail-border)',
          backgroundColor: 'var(--gmail-active-tab)'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--gmail-active-text)' }}>
            {selectionCount} seleccionada{selectionCount === 1 ? '' : 's'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginLeft: '4px' }}>
            {isTrashTab ? (
              <>
                <BulkBtn icon={RotateCcw} label="Restaurar" onClick={() => onBulkAction('restore')} />
                <BulkBtn icon={Trash2} label="Eliminar" danger onClick={() => onBulkAction('delete')} />
              </>
            ) : (
              <>
                <BulkBtn icon={CheckCircle2} label="Completar" onClick={() => onBulkAction('done')} />
                <BulkBtn icon={Trash2} label="Papelera" onClick={() => onBulkAction('trash')} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-active-text)' }}>
                  <Tag size={14} />
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) { onBulkAction('category', e.target.value); e.target.value = ''; } }}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '14px',
                      border: '1px solid var(--gmail-border)',
                      backgroundColor: 'var(--gmail-surface)',
                      color: 'var(--gmail-text-primary)',
                      fontSize: '12.5px',
                      fontWeight: '600'
                    }}
                  >
                    <option value="" disabled>Categoría…</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>

          <button
            onClick={onClearSelection}
            title="Cancelar selección"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-active-text)', padding: '4px 8px' }}
          >
            <X size={14} /> Cancelar
          </button>
        </div>
      )}

      {/* Main Task Rows Container */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--gmail-text-muted)', gap: '10px' }}>
            <RotateCw size={22} className="animate-spin" />
            <span>Cargando tareas...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            color: 'var(--gmail-text-muted)',
            textAlign: 'center',
            padding: '20px'
          }}>
            {currentTab === 'completed' ? (
              <CheckCircle2 size={48} color="#137333" style={{ marginBottom: '12px', opacity: 0.8 }} />
            ) : currentTab === 'trash' ? (
              <Trash2 size={48} color="#d93025" style={{ marginBottom: '12px', opacity: 0.8 }} />
            ) : (
              <Inbox size={48} color="#1a73e8" style={{ marginBottom: '12px', opacity: 0.8 }} />
            )}
            
            <h3 style={{ fontSize: '16px', fontWeight: '500', color: 'var(--gmail-text-primary)', margin: '0 0 6px 0' }}>
              {currentTab === 'completed' ? 'No hay tareas completadas' :
               currentTab === 'trash' ? 'La papelera está vacía' :
               'No hay tareas en esta categoría'}
            </h3>
            <p style={{ fontSize: '13px', margin: 0, maxWidth: '320px' }}>
              {currentTab === 'inbox' ? '¡Todo al día! Puedes hacer clic en "+ Redactar tarea" para añadir un nuevo pendiente.' : 'Crea o cambia el estado de tus tareas para verlas aquí.'}
            </p>
          </div>
        ) : (
          displayTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onToggleDone={onToggleDone}
              onToggleStar={onToggleStar}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleSubtask={onToggleSubtask}
              selected={selectedIds.has(task.id)}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>

    </main>
  );
}
