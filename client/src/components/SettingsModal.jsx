import React, { useState, useEffect, useRef } from 'react';
import { useModalA11y } from '../useModalA11y';
import { X, Save, Mail, Clock, CheckCircle, Bell, Download, Upload } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onTriggerNotification,
  notificationPermission,
  onRequestPermission,
  onExportBackup,
  onImportBackup
}) {
  const [notificationMode, setNotificationMode] = useState('browser');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderPass, setSenderPass] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const dialogRef = useRef(null);
  useModalA11y(isOpen, onClose, dialogRef);

  useEffect(() => {
    if (settings) {
      setNotificationMode(settings.notificationMode || 'browser');
      setSenderEmail(settings.senderEmail || '');
      setSenderPass(settings.senderPass || '');
      setRecipientEmail(settings.recipientEmail || '');
      setScheduledTime(settings.scheduledTime || '08:00');
      setAutoSendEnabled(settings.autoSendEnabled !== undefined ? settings.autoSendEnabled : true);
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSaveSettings({
      notificationMode,
      senderEmail: senderEmail.trim(),
      senderPass: senderPass.trim(),
      recipientEmail: recipientEmail.trim(),
      scheduledTime,
      autoSendEnabled
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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
        backgroundColor: '#ffffff',
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

          {/* Section 1: Mode Selector */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gmail-text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
              Modo de Alerta / Envío de Resumen
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              
              {/* Option: Browser Notification */}
              <div 
                onClick={() => setNotificationMode('browser')}
                style={{
                  border: notificationMode === 'browser' ? '2px solid #1a73e8' : '1px solid var(--gmail-border)',
                  backgroundColor: notificationMode === 'browser' ? '#e8f0fe' : '#f8f9fa',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s'
                }}
              >
                <Bell size={22} color={notificationMode === 'browser' ? '#1a73e8' : '#5f6368'} style={{ marginBottom: '4px' }} />
                <div style={{ fontSize: '13px', fontWeight: '700', color: notificationMode === 'browser' ? '#1a73e8' : 'var(--gmail-text-primary)' }}>
                  Escritorio 🔔
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gmail-text-muted)', marginTop: '2px' }}>
                  Sin configuración (Recomendado)
                </div>
              </div>

              {/* Option: Gmail SMTP */}
              <div 
                onClick={() => setNotificationMode('gmail')}
                style={{
                  border: notificationMode === 'gmail' ? '2px solid #ea4335' : '1px solid var(--gmail-border)',
                  backgroundColor: notificationMode === 'gmail' ? '#fce8e6' : '#f8f9fa',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s'
                }}
              >
                <Mail size={22} color={notificationMode === 'gmail' ? '#ea4335' : '#5f6368'} style={{ marginBottom: '4px' }} />
                <div style={{ fontSize: '13px', fontWeight: '700', color: notificationMode === 'gmail' ? '#ea4335' : 'var(--gmail-text-primary)' }}>
                  Correo Gmail 📧
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gmail-text-muted)', marginTop: '2px' }}>
                  Requiere credenciales
                </div>
              </div>

              {/* Option: Both */}
              <div 
                onClick={() => setNotificationMode('both')}
                style={{
                  border: notificationMode === 'both' ? '2px solid #137333' : '1px solid var(--gmail-border)',
                  backgroundColor: notificationMode === 'both' ? '#e6f4ea' : '#f8f9fa',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Bell size={18} color={notificationMode === 'both' ? '#137333' : '#5f6368'} />
                  <Mail size={18} color={notificationMode === 'both' ? '#137333' : '#5f6368'} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: notificationMode === 'both' ? '#137333' : 'var(--gmail-text-primary)' }}>
                  Ambos 🔔📧
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gmail-text-muted)', marginTop: '2px' }}>
                  Escritorio y Correo
                </div>
              </div>

            </div>
          </div>

          {/* Section 2: Fixed Schedule Time */}
          <div style={{
            backgroundColor: '#e6f4ea',
            border: '1px solid #ceebd6',
            borderRadius: '12px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#137333', fontWeight: '700', fontSize: '13.5px' }}>
              <Clock size={17} />
              <span>Hora Fijada para Recordatorio Diario</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #a8dab5',
                    fontSize: '15px',
                    fontWeight: '700',
                    color: '#137333'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="autoSendCheck"
                  checked={autoSendEnabled}
                  onChange={(e) => setAutoSendEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="autoSendCheck" style={{ fontSize: '13px', fontWeight: '600', color: '#137333', cursor: 'pointer' }}>
                  Activar alerta diaria a esta hora
                </label>
              </div>
            </div>
          </div>

          {/* Browser Permission Panel */}
          {(notificationMode === 'browser' || notificationMode === 'both') && (
            <div style={{
              backgroundColor: notificationPermission === 'granted' ? '#e8f0fe' : '#fef7e0',
              border: notificationPermission === 'granted' ? '1px solid #d2e3fc' : '1px solid #feefc3',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: notificationPermission === 'granted' ? '#1967d2' : '#b06000' }}>
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
          )}

          {/* Section 3: Gmail SMTP Credentials (If Gmail mode selected) */}
          {(notificationMode === 'gmail' || notificationMode === 'both') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px', borderTop: '1px solid var(--gmail-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gmail-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Credenciales SMTP de Gmail
              </div>

              {/* Sender Email */}
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Correo Remitente (Gmail):
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@gmail.com"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gmail-border)', fontSize: '13px' }}
                />
              </div>

              {/* App Password */}
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Contraseña de Aplicación de Google (16 caracteres):
                </label>
                <input
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={senderPass}
                  onChange={(e) => setSenderPass(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gmail-border)', fontSize: '13px' }}
                />
              </div>

              {/* Recipient Email */}
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Correo Destinatario:
                </label>
                <input
                  type="email"
                  placeholder="destinatario@gmail.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gmail-border)', fontSize: '13px' }}
                />
              </div>

            </div>
          )}

          {/* Section 4: Backup / Restore */}
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid var(--gmail-border)',
            borderRadius: '12px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--gmail-text-primary)', fontWeight: '700', fontSize: '13.5px' }}>
              <Download size={17} color="var(--gmail-blue)" />
              <span>Respaldo de Datos</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--gmail-text-secondary)', margin: '0 0 10px 0' }}>
              Descarga una copia de tus tareas, ajustes y cuenta. Guárdala en un lugar seguro (el archivo incluye tu contraseña).
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onExportBackup}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#e8f0fe',
                  color: '#1967d2',
                  padding: '7px 14px',
                  borderRadius: '16px',
                  fontSize: '12.5px',
                  fontWeight: '700'
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
                  cursor: 'pointer'
                }}
              >
                <Upload size={14} />
                <span>Restaurar desde archivo</span>
                <input
                  type="file"
                  accept="application/json"
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
                backgroundColor: '#f1f3f4'
              }}
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--gmail-red)',
                color: '#ffffff',
                padding: '8px 22px',
                borderRadius: '18px',
                fontSize: '13px',
                fontWeight: '600'
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
