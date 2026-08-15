import React, { useState, useEffect, useRef } from 'react';
import { X, Save, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { useModalA11y } from '../useModalA11y';
import { updateUserDisplayName, changeUserPassword, translateFirebaseError } from '../firebase';

export default function ProfileModal({ isOpen, onClose, user, onUpdateProfile }) {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  useModalA11y(isOpen, onClose, dialogRef);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setCurrentPassword('');
      setNewPassword('');
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const nameVal = username.trim();
    const newPassVal = newPassword.trim();
    const currentPassVal = currentPassword.trim();

    if (!nameVal) {
      setErrorMsg('El nombre de usuario no puede estar vacío');
      return;
    }
    if (newPassVal && !currentPassVal) {
      setErrorMsg('Para cambiar la contraseña, ingresá primero tu contraseña actual');
      return;
    }
    if (newPassVal && newPassVal.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      if (nameVal !== user?.username) {
        await updateUserDisplayName(nameVal);
      }
      if (newPassVal) {
        await changeUserPassword(currentPassVal, newPassVal);
      }

      setSuccessMsg('Perfil actualizado correctamente');
      onUpdateProfile({ username: nameVal });
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

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
      zIndex: 250,
      backdropFilter: 'blur(3px)'
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Configuración de cuenta"
        tabIndex={-1}
        style={{
        width: 'min(460px, 92vw)',
        backgroundColor: 'var(--gmail-modal-bg)',
        borderRadius: '20px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        border: '1px solid var(--gmail-border)'
      }} className="animate-fade-in">

        {/* Header */}
        <div style={{
          backgroundColor: 'var(--gmail-blue)',
          color: '#ffffff',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', fontWeight: '600' }}>
            <User size={20} />
            <span>Configuración de Cuenta</span>
          </div>
          <button onClick={onClose} style={{ color: '#ffffff', padding: '4px', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Success / Error Alerts */}
          {successMsg && (
            <div style={{ backgroundColor: '#e6f4ea', color: '#137333', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div style={{ backgroundColor: '#fce8e6', color: '#c5221f', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Email (read-only — tied to the account, not editable here) */}
          {user?.email && (
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '6px' }}>
                Correo:
              </label>
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--gmail-border)',
                backgroundColor: 'var(--gmail-hover)',
                color: 'var(--gmail-text-secondary)',
                fontSize: '14px'
              }}>
                {user.email}
              </div>
            </div>
          )}

          {/* Username Input */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Nombre de la Cuenta:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--gmail-border)',
                backgroundColor: 'var(--gmail-bg)',
                color: 'var(--gmail-text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          {/* New Password Input */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '4px' }}>
              Nueva Contraseña (deja en blanco para mantener la actual):
            </label>
            <input
              type="password"
              placeholder="Nueva contraseña..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--gmail-border)',
                backgroundColor: 'var(--gmail-bg)',
                color: 'var(--gmail-text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Current Password Input — only needed to confirm a password change */}
          {newPassword.trim() && (
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '4px' }}>
                Contraseña Actual (para confirmar el cambio):
              </label>
              <input
                type="password"
                placeholder="Tu contraseña actual..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--gmail-border)',
                  backgroundColor: 'var(--gmail-bg)',
                  color: 'var(--gmail-text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--gmail-blue)',
                color: '#ffffff',
                padding: '8px 20px',
                borderRadius: '18px',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              <Save size={15} />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
