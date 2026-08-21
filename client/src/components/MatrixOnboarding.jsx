import React, { useState, useEffect } from 'react';
import { X, Move, MousePointer2 } from 'lucide-react';

const STORAGE_KEY = 'pulse_matrix_onboarding_dismissed';

// No step here actually points at/highlights the real UI element it
// describes — this is a plain centered dialog, not a guided tour. Keep the
// copy honest about what exists instead of promising a spotlight that isn't
// there.
const STEPS = [
  {
    title: 'Bienvenido a la Matriz de Eisenhower',
    text: 'Esta cuadrícula organiza tus tareas automáticamente según su urgencia e importancia.',
    icon: null
  },
  {
    title: 'Arrastra para reorganizar',
    text: 'En computadora, arrastra una tarjeta a otro cuadrante para moverla. En el celular, usa el botón de mover (→) de cada tarjeta — el arrastre no funciona con el dedo.',
    icon: Move
  },
  {
    title: 'Haz clic para crear',
    text: 'Usa el botón "+ Nueva Tarea" o el "+" de la esquina de cualquier cuadrante.',
    icon: MousePointer2
  }
];

export default function MatrixOnboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(2px)',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        backgroundColor: 'var(--pulse-surface)',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        position: 'relative',
        border: '1px solid var(--pulse-border)'
      }}>
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--pulse-text-muted)',
            padding: '4px',
            borderRadius: '6px'
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          {current.icon && (
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'var(--pulse-active-tab)',
              color: 'var(--pulse-accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <current.icon size={24} />
            </div>
          )}
          {!current.icon && (
            <div style={{
              fontSize: '32px',
              marginBottom: '8px'
            }}>
              📋
            </div>
          )}
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: 'var(--pulse-text-primary)',
            margin: '0 0 8px'
          }}>
            {current.title}
          </h3>
          <p style={{
            fontSize: '14px',
            color: 'var(--pulse-text-secondary)',
            lineHeight: '1.5',
            margin: 0
          }}>
            {current.text}
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{
            display: 'flex',
            gap: '6px'
          }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: i === step ? 'var(--pulse-accent)' : 'var(--pulse-border)',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={dismiss}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid var(--pulse-border)',
                backgroundColor: 'transparent',
                color: 'var(--pulse-text-muted)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Saltar
            </button>
            <button
              onClick={next}
              style={{
                padding: '8px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'var(--pulse-accent)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(59,130,246,0.3)'
              }}
            >
              {step === STEPS.length - 1 ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
