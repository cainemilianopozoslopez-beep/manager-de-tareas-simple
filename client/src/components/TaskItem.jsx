import React, { useState } from 'react';
import {
  Star,
  CheckCircle,
  Circle,
  Edit3,
  Trash2,
  Clock,
  Repeat,
  TrendingUp,
  ListChecks,
  CheckSquare,
  Square,
  GripVertical
} from 'lucide-react';
import { getEffectivePriority, getTodayStr } from '../taskUtils';

const RECURRENCE_LABELS = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };

const PRIORITY_LABELS = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' };

export default function TaskItem({
  task,
  onToggleDone,
  onToggleStar,
  onEdit,
  onDelete,
  selected = false,
  onToggleSelect,
  onToggleSubtask
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const getPriorityBadgeClass = (p) => {
    switch (p) {
      case 'urgente': return 'badge-urgente';
      case 'alta': return 'badge-alta';
      case 'media': return 'badge-media';
      default: return 'badge-baja';
    }
  };

  const getCategoryPillClass = (c) => {
    switch (c?.toLowerCase()) {
      case 'trabajo': return 'pill-trabajo';
      case 'personal': return 'pill-personal';
      case 'urgente': return 'pill-urgente';
      case 'ideas': return 'pill-ideas';
      default: return 'pill-general';
    }
  };

  const formatDueLabel = () => {
    if (!task.dueDate && !task.dueTime) return '';
    const todayStr = getTodayStr();
    if (task.dueDate && task.dueDate !== todayStr) {
      const [y, m, d] = task.dueDate.split('-');
      // Only show the year when it differs from the current one — "18/08" for
      // this year, "18/08/2027" otherwise, so a far-future or stale/overdue
      // task from a different year isn't mistaken for one due this year.
      const currentYear = todayStr.split('-')[0];
      const dateLabel = y === currentYear ? `${d}/${m}` : `${d}/${m}/${y}`;
      return `${dateLabel}${task.dueTime ? ' ' + task.dueTime : ''}`;
    }
    return task.dueTime ? `Hoy ${task.dueTime}` : 'Hoy';
  };

  const effectivePriority = getEffectivePriority(task);
  const isEscalated = effectivePriority !== (task.priority || 'media');

  // Calculate Subtask Progress
  const subtasks = task.subtasks || [];
  const subtasksDone = subtasks.filter(s => s.done).length;

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable={!task.done}
      onDragStart={handleDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(task)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 14px',
        borderRadius: '12px',
        border: '1px solid var(--pulse-border)',
        backgroundColor: selected
          ? 'var(--pulse-active-tab)'
          : task.done
          ? 'var(--pulse-sidebar-bg)'
          : isHovered
          ? 'var(--pulse-hover)'
          : 'var(--pulse-surface)',
        cursor: 'grab',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        position: 'relative',
        boxShadow: isHovered ? 'var(--pulse-shadow-card)' : 'none',
        opacity: task.done ? 0.65 : 1,
        gap: '10px'
      }}
    >
      {/* Drag Handle Indicator */}
      {!task.done && (
        <div
          title="Arrastrar a otro cuadrante"
          style={{
            color: 'var(--pulse-text-muted)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab'
          }}
        >
          <GripVertical size={15} />
        </div>
      )}

      {/* Selection checkbox for batch actions */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.(task.id);
        }}
        aria-label={selected ? 'Quitar de la selección' : 'Seleccionar tarea'}
        title={selected ? 'Quitar de la selección' : 'Seleccionar tarea'}
        style={{
          padding: '2px',
          color: selected ? 'var(--pulse-accent)' : 'var(--pulse-text-muted)',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {selected ? <CheckSquare size={17} /> : <Square size={17} />}
      </button>

      {/* Done Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(task.id);
        }}
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
        title={task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
        style={{
          padding: '2px',
          color: task.done ? 'var(--pulse-q4-accent)' : 'var(--pulse-text-muted)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {task.done ? <CheckCircle size={19} color="var(--pulse-q4-accent)" fill="var(--pulse-q4-bg)" /> : <Circle size={19} />}
      </button>

      {/* Star Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(task.id);
        }}
        aria-label={task.starred ? 'Quitar de destacadas' : 'Marcar como destacada'}
        title={task.starred ? 'Quitar de destacadas' : 'Marcar como destacada'}
        style={{
          padding: '2px',
          color: task.starred ? '#f59e0b' : 'var(--pulse-text-muted)',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <Star size={17} fill={task.starred ? '#f59e0b' : 'none'} />
      </button>

      {/* Main Content (Title, Description, Progress) */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '13.5px',
            fontWeight: '600',
            color: task.done ? 'var(--pulse-text-muted)' : 'var(--pulse-text-primary)',
            textDecoration: task.done ? 'line-through' : 'none',
            lineHeight: '1.3',
            wordBreak: 'break-word'
          }}>
            {task.title}
          </span>

          {/* Category Pill */}
          {task.category && (
            <span
              className={getCategoryPillClass(task.category)}
              style={{
                fontSize: '10.5px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '10px',
                textTransform: 'capitalize'
              }}
            >
              {task.category}
            </span>
          )}

          {/* Priority Badge */}
          <span
            className={getPriorityBadgeClass(effectivePriority)}
            title={isEscalated ? `Prioridad escalada a ${effectivePriority} por fecha próxima` : `Prioridad: ${task.priority}`}
            style={{
              fontSize: '10.5px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {isEscalated && <TrendingUp size={11} />}
            {PRIORITY_LABELS[effectivePriority] || effectivePriority}
          </span>
        </div>

        {/* Task description or due info */}
        {task.description && (
          <span style={{
            fontSize: '12px',
            color: 'var(--pulse-text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%'
          }}>
            {task.description}
          </span>
        )}

        {/* Meta Row: Subtasks / Steps Progress & Due Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            
            {/* Step Dropdown Menu Toggle Pill */}
            {subtasks.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSteps(prev => !prev);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  backgroundColor: showSteps ? 'var(--pulse-active-tab)' : 'var(--pulse-sidebar-bg)',
                  border: '1px solid var(--pulse-border)',
                  color: subtasksDone === subtasks.length ? 'var(--pulse-q4-accent)' : 'var(--pulse-accent)',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Hacer clic para abrir el menú desplegable de pasos a seguir"
              >
                <ListChecks size={14} />
                <span>Pasos ({subtasksDone}/{subtasks.length})</span>
                <span style={{ fontSize: '10px', marginLeft: '2px' }}>{showSteps ? '▲' : '▼'}</span>
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {formatDueLabel() && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--pulse-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Clock size={12} />
                  {formatDueLabel()}
                </span>
              )}

              {task.recurrence && task.recurrence !== 'none' && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--pulse-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <Repeat size={11} />
                  {RECURRENCE_LABELS[task.recurrence]}
                </span>
              )}
            </div>
          </div>

          {/* Dynamic Adaptive Progress Bar */}
          {subtasks.length > 0 && (
            <div style={{
              width: '100%',
              height: '5px',
              backgroundColor: 'var(--pulse-border)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginTop: '1px'
            }}>
              <div style={{
                width: `${subtasks.length > 0 ? Math.round((subtasksDone / subtasks.length) * 100) : 0}%`,
                height: '100%',
                backgroundColor: subtasksDone === subtasks.length ? 'var(--pulse-q4-accent)' : 'var(--pulse-accent)',
                transition: 'width 0.3s ease',
                borderRadius: '3px'
              }} />
            </div>
          )}

          {/* Menú Desplegable de Pasos a Seguir */}
          {showSteps && subtasks.length > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                backgroundColor: 'var(--pulse-sidebar-bg)',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--pulse-border)',
                boxShadow: 'var(--pulse-shadow-card)'
              }}
            >
              <div style={{
                fontSize: '10.5px',
                fontWeight: '700',
                color: 'var(--pulse-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '2px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Menú de Pasos a Seguir ({subtasksDone} de {subtasks.length} listos)</span>
                <span style={{ color: 'var(--pulse-accent)' }}>
                  {Math.round((subtasksDone / subtasks.length) * 100)}%
                </span>
              </div>

              {subtasks.map((step, idx) => (
                <div
                  key={step.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSubtask?.(task.id, step.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--pulse-surface)',
                    border: '1px solid var(--pulse-border)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ color: step.done ? 'var(--pulse-q4-accent)' : 'var(--pulse-text-muted)', display: 'flex', flexShrink: 0 }}>
                    {step.done ? <CheckSquare size={16} color="var(--pulse-q4-accent)" /> : <Square size={16} />}
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: step.done ? 'var(--pulse-text-muted)' : 'var(--pulse-accent)',
                    minWidth: '44px',
                    flexShrink: 0
                  }}>
                    Paso {idx + 1}:
                  </span>

                  <span style={{
                    fontSize: '12.5px',
                    fontWeight: '500',
                    color: step.done ? 'var(--pulse-text-muted)' : 'var(--pulse-text-primary)',
                    textDecoration: step.done ? 'line-through' : 'none',
                    flex: 1,
                    wordBreak: 'break-word'
                  }}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover Action Buttons (Edit, Delete) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        opacity: isHovered ? 1 : 0.4,
        transition: 'opacity 0.15s ease'
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          aria-label="Editar tarea"
          title="Editar tarea"
          style={{
            padding: '10px',
            borderRadius: '8px',
            color: 'var(--pulse-text-secondary)',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Edit3 size={15} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          aria-label="Borrar tarea"
          title="Borrar tarea"
          style={{
            padding: '10px',
            borderRadius: '8px',
            color: 'var(--pulse-q1-accent, #ef4444)',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
