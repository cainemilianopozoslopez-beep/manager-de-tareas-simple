import React, { useState, useEffect, useRef } from 'react';
import { useModalA11y } from '../useModalA11y';
import { X, Save, Clock, CheckCircle, Bell, Download, Upload } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  isGuest = false,
  onSaveSettings,
  onTriggerNotification,
  notificationPermission,
  onRequestPermission,
  onExportBackup,
  onImportBackup
}) {
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const dialogRef = useRef(null);
  const savedBannerTimeoutRef = useRef(null);
  useModalA11y(isOpen, onClose, dialogRef);

  useEffect(() => {
    if (settings) {
      setScheduledTime(settings.scheduledTime || '08:00');
      setAutoSendEnabled(settings.autoSendEnabled !== undefined ? settings.autoSendEnabled : true);
    }
  }, [settings, isOpen]);

  useEffect(() => {
    return () => {
      if (savedBannerTimeoutRef.current) clearTimeout(savedBannerTimeoutRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isGuest) return;
    await onSaveSettings({
      notificationMode: 'browser',
      scheduledTime,
      autoSendEnabled
    });
    setSavedSuccess(true);
    savedBannerTimeoutRef.current = setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.4)',
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
        aria-label="Configuración de notificaciones y horario"
        tabIndex={-1}
        style={{
        width: 'min(580px, 92vw)',
        maxHeight: '90vh',
        backgroundColor: 'var(--gmail-modal-bg)',
        color: 'var(--gmail-text-primary)',
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        border: '1px solid var(--gmail-border)',
        display: 'flex',
        flexDirection: 'column'
      }} className="animate-fade-in">

        {/* Modal Header */}
        <div style={{
          backgroundColor: '#ea4335',
          color: '#ffffff',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={22} />
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              Configuración de Notificaciones y Horario
            </h2>
          </div>
          <button onClick={onClose} style={{ color: '#ffffff', padding: '4px', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>

          {/* Section 1: Fixed Schedule Time */}
          <div style={{
            backgroundColor: 'var(--pulse-q4-bg, #e6f4ea)',
            border: '1px solid var(--pulse-q4-border, #ceebd6)',
            borderRadius: '12px',
            padding: '14px',
            opacity: isGuest ? 0.6 : 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--pulse-q4-accent, #137333)', fontWeight: '700', fontSize: '13.5px' }}>
              <Clock size={17} />
              <span>Hora Fijada para Recordatorio Diario</span>
            </div>

            {isGuest && (
              <p style={{ fontSize: '12px', color: 'var(--pulse-q4-accent, #137333)', margin: '0 0 10px 0' }}>
                Esto requiere una cuenta registrada — en Modo Invitado no se puede guardar.
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="settings-schedule-time" className="sr-only">Hora de recordatorio diario</label>
                <input
                  id="settings-schedule-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  disabled={isGuest}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--pulse-q4-border, #a8dab5)',
                    fontSize: '15px',
                    fontWeight: '700',
                    color: 'var(--pulse-q4-accent, #137333)',
                    cursor: isGuest ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="autoSendCheck"
                  checked={autoSendEnabled}
                  onChange={(e) => setAutoSendEnabled(e.target.checked)}
                  disabled={isGuest}
                  style={{ width: '18px', height: '18px', cursor: isGuest ? 'not-allowed' : 'pointer' }}
                />
                <label htmlFor="autoSendCheck" style={{ fontSize: '13px', fontWeight: '600', color: '#137333', cursor: isGuest ? 'not-allowed' : 'pointer' }}>
                  Activar alerta diaria a esta hora
                </label>
              </div>
            </div>
          </div>

          {/* Browser Permission Panel */}
          <div style={{
              backgroundColor: notificationPermission === 'granted' ? 'var(--pulse-active-tab, #e8f0fe)' : 'var(--pulse-hover, #fef7e0)',
              border: notificationPermission === 'granted' ? '1px solid var(--pulse-border, #d2e3fc)' : '1px solid var(--pulse-border-hover, #feefc3)',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: notificationPermission === 'granted' ? 'var(--pulse-accent, #1967d2)' : 'var(--pulse-q2-accent, #b06000)' }}>
                  {notificationPermission === 'granted' ? '✅ Permiso de notificaciones concedido' : '⚠️ Notificaciones no autorizadas aún'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gmail-text-secondary)', marginTop: '2px' }}>
                  {notificationPermission === 'granted' ? 'El navegador enviará notificaciones flotantes automáticamente.' : 'Haz clic para permitir que el navegador envíe alertas flotantes.'}
                </div>
              </div>

              {notificationPermission !== 'granted' ? (
                <button
                  type="button"
                  onClick={onRequestPermission}
                  style={{
                    backgroundColor: '#f29900',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '14px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  Permitir 🔔
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onTriggerNotification}
                  style={{
                    backgroundColor: '#1a73e8',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '14px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  Probar Notificación 🔔
                </button>
              )}
            </div>

          {/* Section 2: Backup / Restore */}
          <div style={{
            backgroundColor: 'var(--gmail-hover)',
            border: '1px solid var(--gmail-border)',
            borderRadius: '12px',
            padding: '14px',
            opacity: isGuest ? 0.6 : 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--gmail-text-primary)', fontWeight: '700', fontSize: '13.5px' }}>
              <Download size={17} color="var(--gmail-blue)" />
              <span>Respaldo de Datos</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--gmail-text-secondary)', margin: '0 0 10px 0' }}>
              {isGuest
                ? 'Esto requiere una cuenta registrada — en Modo Invitado no hay nada que respaldar en la nube.'
                : 'Descarga una copia de tus tareas y ajustes en un archivo. Guárdala en un lugar seguro.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onExportBackup}
                disabled={isGuest}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#e8f0fe',
                  color: '#1967d2',
                  padding: '7px 14px',
                  borderRadius: '16px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: isGuest ? 'not-allowed' : 'pointer'
                }}
              >
                <Download size={14} />
                <span>Descargar copia</span>
              </button>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--gmail-hover)',
                  color: 'var(--gmail-text-primary)',
                  padding: '7px 14px',
                  borderRadius: '16px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: isGuest ? 'not-allowed' : 'pointer'
                }}
              >
                <Upload size={14} />
                <span>Restaurar desde archivo</span>
                <input
                  type="file"
                  accept="application/json"
                  disabled={isGuest}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) onImportBackup(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {/* Save Status Banner */}
          {savedSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#137333', fontSize: '13px', fontWeight: '600' }}>
              <CheckCircle size={16} /> Configuración de alerta guardada correctamente.
            </div>
          )}

          {/* Modal Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '4px',
            borderTop: '1px solid var(--gmail-border)',
            paddingTop: '16px'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '18px',
                fontSize: '13px',
                color: 'var(--gmail-text-secondary)',
                backgroundColor: 'var(--gmail-hover)'
              }}
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              disabled={isGuest}
              title={isGuest ? 'Requiere una cuenta registrada' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: isGuest ? 'var(--gmail-hover)' : 'var(--gmail-blue)',
                color: isGuest ? 'var(--gmail-text-muted)' : '#ffffff',
                padding: '8px 22px',
                borderRadius: '18px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isGuest ? 'not-allowed' : 'pointer'
              }}
            >
              <Save size={15} />
              <span>Guardar Ajustes</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
