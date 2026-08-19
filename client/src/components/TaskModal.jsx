import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Clock, Calendar, Repeat, Plus, CheckSquare, Square, ListChecks } from 'lucide-react';
import { getTodayStr, dateStrDaysFromToday } from '../taskUtils';
import { useModalA11y } from '../useModalA11y';
import MicButton from './MicButton';

// Appends dictated text to whatever's already in the field, rather than
// replacing it — dictation is meant to add to typed content, not clobber it.
const appendDictated = (prev, text) => (prev.trim() ? `${prev.trim()} ${text}` : text);

const DATE_PRESETS = [
  { label: 'Hoy', days: 0 },
  { label: 'Mañana', days: 1 },
  { label: '+1 sem', days: 7 }
];

export default function TaskModal({
  isOpen,
  onClose,
  onSave,
  initialTask,
  initialDate,
  categories = []
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('media');
  const [category, setCategory] = useState('trabajo');
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [dueTime, setDueTime] = useState('10:00');
  const [recurrence, setRecurrence] = useState('none');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Synchronous re-entry guard: state updates are async, so a rapid double-click
  // could slip a second submit through before `submitting` re-renders. The ref blocks
  // that same-tick, the state drives the disabled/visual feedback.
  const submitLock = useRef(false);
  const dialogRef = useRef(null);
  useModalA11y(isOpen, onClose, dialogRef);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '');
      setDescription(initialTask.description || '');
      setPriority(initialTask.priority || 'media');
      setCategory(initialTask.category || 'trabajo');
      setDueDate(initialTask.dueDate || getTodayStr());
      setDueTime(initialTask.dueTime || '10:00');
      setRecurrence(initialTask.recurrence || 'none');
      setSubtasks(initialTask.subtasks || []);
    } else {
      setTitle('');
      setDescription('');
      setPriority('media');
      setCategory('trabajo');
      setDueDate(initialDate || getTodayStr());
      setDueTime('10:00');
      setRecurrence('none');
      setSubtasks([]);
    }
    setNewSubtask('');
    // Reset the guard whenever the modal (re)opens or switches task.
    submitLock.current = false;
    setSubmitting(false);
  }, [initialTask, initialDate, isOpen]);

  const addSubtask = () => {
    const text = newSubtask.trim();
    if (!text) return;
    setSubtasks(prev => [...prev, { id: 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), text, done: false }]);
    setNewSubtask('');
  };
  const toggleSubtask = (id) => setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
  const updateSubtaskText = (id, text) => setSubtasks(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  const removeSubtask = (id) => setSubtasks(prev => prev.filter(s => s.id !== id));

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || submitLock.current) return;

    submitLock.current = true;
    setSubmitting(true);
    try {
      await onSave({
        id: initialTask?.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        category: category.trim().toLowerCase() || 'general',
        dueDate,
        dueTime,
        recurrence,
        subtasks: subtasks.map(s => ({ ...s, text: s.text.trim() })).filter(s => s.text)
      });
      onClose();
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={initialTask ? 'Editar tarea' : 'Nueva tarea'}
      tabIndex={-1}
      style={{
      position: 'fixed',
      bottom: '16px',
      right: '24px',
      width: '540px',
      maxHeight: 'calc(100vh - 32px)',
      backgroundColor: 'var(--gmail-modal-bg)',
      color: 'var(--gmail-text-primary)',
      borderRadius: '12px 12px 0 0',
      boxShadow: '0 8px 30px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid var(--gmail-border)',
      zIndex: 100,
      overflowY: 'auto'
    }} className="animate-slide-up task-compose-modal">

      {/* Gmail Compose Window Header */}
      <div style={{
        backgroundColor: 'var(--gmail-search-bg)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--gmail-border)'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gmail-active-text)' }}>
          {initialTask ? '✏️ Editar Tarea' : '✉️ Nueva Tarea (Redactar)'}
        </span>
        <button
          onClick={onClose}
          style={{ padding: '4px', borderRadius: '50%', color: 'var(--gmail-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gmail-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X size={18} />
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Title Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Título de la tarea..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            style={{
              width: '100%',
              fontSize: '16px',
              fontWeight: '600',
              border: 'none',
              borderBottom: '2px solid var(--gmail-border)',
              padding: '8px 32px 8px 0',
              backgroundColor: 'transparent',
              color: 'var(--gmail-text-primary)'
            }}
          />
          <MicButton
            onResult={(text) => setTitle(prev => appendDictated(prev, text))}
            label="Dictar título por voz"
            style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>

        {/* Row Settings: Category, Priority, Date, Time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

          {/* Category (editable, suggests existing categories but accepts new ones) */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Categoría
            </label>
            <input
              type="text"
              list="task-category-options"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="trabajo, personal..."
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid var(--gmail-border)',
                backgroundColor: 'var(--gmail-bg)',
                fontSize: '13px',
                color: 'var(--gmail-text-primary)',
                textTransform: 'capitalize'
              }}
            />
            <datalist id="task-category-options">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Priority Select */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Prioridad
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid var(--gmail-border)',
                backgroundColor: 'var(--gmail-bg)',
                fontSize: '13px',
                color: 'var(--gmail-text-primary)'
              }}
            >
              <option value="baja">🟢 Baja</option>
              <option value="media">🔵 Media</option>
              <option value="alta">🟡 Alta</option>
              <option value="urgente">🔴 Urgente</option>
            </select>
          </div>

          {/* Date Input */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              <Calendar size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
              Fecha Límite
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                width: '100%',
                padding: '7px',
                borderRadius: '8px',
                border: '1px solid var(--gmail-border)',
                backgroundColor: 'var(--gmail-bg)',
                fontSize: '13px',
                color: 'var(--gmail-text-primary)'
              }}
            />
            {/* Quick-date presets so the common cases don't need the date picker. */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
              {DATE_PRESETS.map(p => {
                const presetDate = dateStrDaysFromToday(p.days);
                const active = dueDate === presetDate;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setDueDate(presetDate)}
                    style={{
                      flex: 1,
                      padding: '3px 4px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      border: '1px solid var(--gmail-border)',
                      color: active ? 'var(--gmail-active-text)' : 'var(--gmail-text-secondary)',
                      backgroundColor: active ? 'var(--gmail-active-tab)' : 'transparent'
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Input */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              <Clock size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
              Hora de vencimiento
            </label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              style={{
                width: '100%',
                padding: '7px',
                borderRadius: '8px',
                border: '1px solid var(--gmail-border)',
                backgroundColor: 'var(--gmail-bg)',
                fontSize: '13px',
                color: 'var(--gmail-text-primary)'
              }}
            />
          </div>

          {/* Recurrence Select */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gmail-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              <Repeat size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
              Repetir
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid var(--gmail-border)',
                backgroundColor: 'var(--gmail-bg)',
                fontSize: '13px',
                color: 'var(--gmail-text-primary)'
              }}
            >
              <option value="none">No se repite</option>
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>

        </div>

        <p style={{ fontSize: '11px', color: 'var(--gmail-text-muted)', margin: '-6px 0 0 0' }}>
          💡 La prioridad que elijas es un mínimo: conforme se acerque la fecha límite, la tarea va a mostrarse más urgente sola (nunca más abajo de lo que pongas aquí).
        </p>

        {/* Description Textarea */}
        <div style={{ position: 'relative' }}>
          <textarea
            placeholder="Añade detalles o notas adicionales para esta tarea..."
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              paddingRight: '34px',
              borderRadius: '8px',
              border: '1px solid var(--gmail-border)',
              backgroundColor: 'var(--gmail-bg)',
              fontSize: '13.5px',
              color: 'var(--gmail-text-primary)',
              resize: 'vertical'
            }}
          />
          <MicButton
            onResult={(text) => setDescription(prev => appendDictated(prev, text))}
            label="Dictar descripción por voz"
            style={{ position: 'absolute', right: '8px', top: '8px' }}
          />
        </div>

        {/* Sequential Steps Panel */}
        <div style={{
          backgroundColor: 'var(--pulse-sidebar-bg)',
          padding: '14px',
          borderRadius: '12px',
          border: '1px solid var(--pulse-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--pulse-text-primary)', textTransform: 'uppercase' }}>
              <ListChecks size={15} color="var(--pulse-accent)" />
              Pasos de Ejecución
              {subtasks.length > 0 && (
                <span style={{ fontWeight: '700', textTransform: 'none', color: 'var(--pulse-accent)', backgroundColor: 'var(--pulse-surface)', padding: '2px 8px', borderRadius: '10px', fontSize: '11.5px', border: '1px solid var(--pulse-border)' }}>
                  {subtasks.filter(s => s.done).length} de {subtasks.length} completados ({subtasks.length > 0 ? Math.round((subtasks.filter(s => s.done).length / subtasks.length) * 100) : 0}%)
                </span>
              )}
            </label>
          </div>

          <p style={{ fontSize: '11.5px', color: 'var(--pulse-text-muted)', margin: '0 0 10px 0' }}>
            ✨ <strong>Auto-Completado:</strong> Al completar el último paso de esta secuencia, la tarea principal se marcará automáticamente como hecha.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {subtasks.map((s, idx) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--pulse-surface)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--pulse-border)' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--pulse-text-muted)', minWidth: '45px' }}>
                  Paso {idx + 1}
                </span>

                <button
                  type="button"
                  onClick={() => toggleSubtask(s.id)}
                  aria-label={s.done ? 'Marcar paso como pendiente' : 'Marcar paso como hecho'}
                  style={{ display: 'flex', color: s.done ? 'var(--pulse-q4-accent)' : 'var(--pulse-text-muted)', padding: '2px' }}
                >
                  {s.done ? <CheckSquare size={16} color="var(--pulse-q4-accent)" /> : <Square size={16} />}
                </button>

                <input
                  type="text"
                  value={s.text}
                  onChange={(e) => updateSubtaskText(s.id, e.target.value)}
                  placeholder={`Descripción del paso ${idx + 1}...`}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--pulse-border)',
                    backgroundColor: 'var(--pulse-sidebar-bg)',
                    fontSize: '13px',
                    color: 'var(--pulse-text-primary)',
                    textDecoration: s.done ? 'line-through' : 'none',
                    opacity: s.done ? 0.65 : 1
                  }}
                />

                <button
                  type="button"
                  onClick={() => removeSubtask(s.id)}
                  aria-label="Eliminar paso"
                  style={{ display: 'flex', color: '#ef4444', padding: '2px' }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Step Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
              placeholder="+ Añadir nuevo paso y pulsar Enter..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px dashed var(--pulse-border)',
                backgroundColor: 'var(--pulse-surface)',
                fontSize: '13px',
                color: 'var(--pulse-text-primary)'
              }}
            />
            <button
              type="button"
              onClick={addSubtask}
              aria-label="Añadir paso"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--pulse-accent)',
                color: '#ffffff',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: '600'
              }}
            >
              <Plus size={16} /> Añadir Paso
            </button>
          </div>
        </div>

        {/* Action Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '8px',
          borderTop: '1px solid var(--gmail-border)',
          paddingTop: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '18px',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--gmail-text-secondary)',
              backgroundColor: 'var(--gmail-hover)'
            }}
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--gmail-blue)',
              color: '#ffffff',
              padding: '8px 20px',
              borderRadius: '18px',
              fontSize: '13px',
              fontWeight: '600',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              opacity: (submitting || !title.trim()) ? 0.6 : 1,
              cursor: (submitting || !title.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={15} />
            <span>{submitting ? 'Guardando…' : (initialTask ? 'Guardar Cambios' : 'Crear Tarea')}</span>
          </button>
        </div>

      </form>
    </div>
  );
}
