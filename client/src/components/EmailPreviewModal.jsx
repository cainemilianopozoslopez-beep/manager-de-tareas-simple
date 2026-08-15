import React, { useMemo, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { useModalA11y } from '../useModalA11y';
import { generateTaskEmailHTML } from '../emailTemplate';

export default function EmailPreviewModal({
  isOpen,
  onClose,
  onSendNow,
  sending,
  pendingTasks = [],
  scheduledTime = '08:00'
}) {
  const dialogRef = useRef(null);
  useModalA11y(isOpen, onClose, dialogRef);

  // Built entirely client-side from the tasks already loaded in the app — no
  // network call, so this stays accurate whether tasks live in Firestore or in a
  // guest's local session.
  const previewHtml = useMemo(
    () => generateTaskEmailHTML(pendingTasks, scheduledTime),
    [pendingTasks, scheduledTime]
  );

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      backdropFilter: 'blur(3px)'
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa del correo de resumen"
        tabIndex={-1}
        style={{
        width: 'min(720px, 92vw)',
        maxHeight: '90vh',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--gmail-border)'
      }} className="animate-fade-in">

        {/* Header */}
        <div style={{
          backgroundColor: '#ea4335',
          color: '#ffffff',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '16px', fontWeight: '600' }}>
            📧 Vista Previa del Correo Resumen de Gmail
          </span>
          <button onClick={onClose} style={{ color: '#ffffff' }}>
            <X size={20} />
          </button>
        </div>

        {/* Subheader Toolbar */}
        <div style={{
          padding: '10px 20px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: '#5f6368'
        }}>
          <span>Plantilla HTML en vivo generada desde tus tareas pendientes actuales:</span>
          
          <button
            onClick={onSendNow}
            disabled={sending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--gmail-red)',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '16px',
              fontSize: '12.5px',
              fontWeight: '600'
            }}
          >
            <Send size={14} />
            <span>{sending ? 'Enviando...' : 'Enviar por Gmail Ahora'}</span>
          </button>
        </div>

        {/* Iframe Preview Container */}
        <div style={{ flex: 1, backgroundColor: '#f6f8fc', padding: '16px', minHeight: '450px' }}>
          <iframe
            srcDoc={previewHtml}
            title="Email Preview"
            style={{
              width: '100%',
              height: '100%',
              minHeight: '450px',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              backgroundColor: '#ffffff'
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '18px',
              backgroundColor: '#f1f3f4',
              color: 'var(--gmail-text-primary)',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            Cerrar Vista Previa
          </button>
        </div>

      </div>
    </div>
  );
}
