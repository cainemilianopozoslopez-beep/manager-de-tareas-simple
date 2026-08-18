import React, { useState } from 'react';
import {
  AlertCircle,
  Clock,
  Zap,
  CheckCircle2,
  Plus,
  ArrowRight,
  Inbox,
  Flame,
  Calendar,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import TaskItem from './TaskItem';
import { getEisenhowerQuadrant } from '../taskUtils';

const QUADRANTS = [
  {
    id: 'q1',
    title: 'Hacer Ya (Do First)',
    subtitle: 'Urgente e Importante',
    description: 'Prioridad alta con vencimiento cercano. Resuélvelas primero.',
    icon: Flame,
    colorVar: 'var(--pulse-q1-accent)',
    bgVar: 'var(--pulse-q1-bg)',
    borderVar: 'var(--pulse-q1-border)',
    defaultPriority: 'urgente'
  },
  {
    id: 'q2',
    title: 'Planificar (Schedule)',
    subtitle: 'Importante, No Urgente',
    description: 'Metas importantes con plazo amplio o recurrentes.',
    icon: Calendar,
    colorVar: 'var(--pulse-q2-accent)',
    bgVar: 'var(--pulse-q2-bg)',
    borderVar: 'var(--pulse-q2-border)',
    defaultPriority: 'alta'
  },
  {
    id: 'q3',
    title: 'Delegar / Rápido (Delegate)',
    subtitle: 'Urgente, No Importante',
    description: 'Tareas secundarias que requieren atención rápida.',
    icon: Zap,
    colorVar: 'var(--pulse-q3-accent)',
    bgVar: 'var(--pulse-q3-bg)',
    borderVar: 'var(--pulse-q3-border)',
    defaultPriority: 'media'
  },
  {
    id: 'q4',
    title: 'Revisar (Review)',
    subtitle: 'Ni Urgente ni Importante',
    description: 'Actividades de baja prioridad o ideas secundarias.',
    icon: Sparkles,
    colorVar: 'var(--pulse-q4-accent)',
    bgVar: 'var(--pulse-q4-bg)',
    borderVar: 'var(--pulse-q4-border)',
    defaultPriority: 'baja'
  }
];

export default function MatrixView({
  tasks,
  loading,
  onToggleDone,
  onToggleStar,
  onEdit,
  onDelete,
  onOpenComposeWithQuadrant,
  onMoveToQuadrant,
  onToggleSubtask,
  selectedIds = new Set(),
  onToggleSelect
}) {
  const [draggedOverQuadrant, setDraggedOverQuadrant] = useState(null);

  // Exclude trashed tasks from the Eisenhower matrix
  const activeTasks = tasks.filter(t => !t.trash);

  // Group active tasks by Eisenhower Quadrant
  const grouped = {
    q1: [],
    q2: [],
    q3: [],
    q4: []
  };

  activeTasks.forEach(task => {
    const q = getEisenhowerQuadrant(task);
    if (grouped[q]) {
      grouped[q].push(task);
    } else {
      grouped.q4.push(task);
    }
  });

  const handleDragOver = (e, qId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverQuadrant !== qId) {
      setDraggedOverQuadrant(qId);
    }
  };

  const handleDragLeave = (e, qId) => {
    e.preventDefault();
    if (draggedOverQuadrant === qId) {
      setDraggedOverQuadrant(null);
    }
  };

  const handleDrop = (e, qId) => {
    e.preventDefault();
    setDraggedOverQuadrant(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && onMoveToQuadrant) {
      onMoveToQuadrant(taskId, qId);
    }
  };

  return (
    <main style={{
      flex: 1,
      padding: '20px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      height: 'calc(100vh - 64px)'
    }}>
      {/* Eisenhower Matrix Header Summary */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'var(--pulse-surface)',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid var(--pulse-border)',
        boxShadow: 'var(--pulse-shadow-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: 'var(--pulse-active-tab)',
            color: 'var(--pulse-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap size={22} />
          </div>
          <div>
            <h1 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--pulse-text-primary)',
              lineHeight: '1.2'
            }}>
              Matriz de Prioridades y Flujo
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--pulse-text-muted)', marginTop: '2px' }}>
              Arrastra las tarjetas entre cuadrantes para reasignar prioridad y urgencia al instante.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '12.5px',
            fontWeight: '600',
            color: 'var(--pulse-text-secondary)',
            backgroundColor: 'var(--pulse-sidebar-bg)',
            padding: '6px 14px',
            borderRadius: '20px',
            border: '1px solid var(--pulse-border)'
          }}>
            {activeTasks.length} Tareas Activas
          </span>
        </div>
      </div>

      {/* 2x2 Quadrant Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px',
        flex: 1,
        minHeight: 0
      }}>
        {QUADRANTS.map(q => {
          const Icon = q.icon;
          const qTasks = grouped[q.id] || [];
          const isOver = draggedOverQuadrant === q.id;

          return (
            <div
              key={q.id}
              onDragOver={(e) => handleDragOver(e, q.id)}
              onDragLeave={(e) => handleDragLeave(e, q.id)}
              onDrop={(e) => handleDrop(e, q.id)}
              style={{
                backgroundColor: isOver ? 'var(--pulse-active-tab)' : 'var(--pulse-surface)',
                borderRadius: '16px',
                border: isOver ? `2px dashed ${q.colorVar}` : `1px solid ${q.borderVar}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: isOver ? '0 8px 24px rgba(0,0,0,0.15)' : 'var(--pulse-shadow-card)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {/* Quadrant Header */}
              <div style={{
                padding: '14px 18px',
                borderBottom: `1px solid ${q.borderVar}`,
                backgroundColor: q.bgVar,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: q.colorVar,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 2px 8px ${q.colorVar}40`
                  }}>
                    <Icon size={17} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: '14.5px',
                      fontWeight: '700',
                      color: 'var(--pulse-text-primary)',
                      lineHeight: '1.2'
                    }}>
                      {q.title}
                    </h2>
                    <span style={{ fontSize: '11px', color: 'var(--pulse-text-muted)', fontWeight: '500' }}>
                      {q.subtitle}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--pulse-surface)',
                    color: q.colorVar,
                    border: `1px solid ${q.borderVar}`
                  }}>
                    {qTasks.length}
                  </span>

                  <button
                    onClick={() => onOpenComposeWithQuadrant && onOpenComposeWithQuadrant(q.defaultPriority)}
                    title={`Agregar nueva tarea a ${q.title}`}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--pulse-surface)',
                      color: q.colorVar,
                      border: `1px solid ${q.borderVar}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Task Cards List inside Quadrant */}
              <div style={{
                flex: 1,
                padding: '12px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                minHeight: '180px'
              }}>
                {loading ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--pulse-text-muted)', fontSize: '13px' }}>
                    Cargando tareas...
                  </div>
                ) : qTasks.length === 0 ? (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 12px',
                    textAlign: 'center',
                    border: `1px dashed ${q.borderVar}`,
                    borderRadius: '12px',
                    backgroundColor: 'transparent'
                  }}>
                    <p style={{ fontSize: '12.5px', color: 'var(--pulse-text-muted)', marginBottom: '8px' }}>
                      Sin tareas en este cuadrante
                    </p>
                    <button
                      onClick={() => onOpenComposeWithQuadrant && onOpenComposeWithQuadrant(q.defaultPriority)}
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: q.colorVar,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={14} />
                      Añadir tarea
                    </button>
                  </div>
                ) : (
                  qTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggleDone={onToggleDone}
                      onToggleStar={onToggleStar}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggleSubtask={onToggleSubtask}
                      isSelected={selectedIds.has(task.id)}
                      onToggleSelect={onToggleSelect}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
