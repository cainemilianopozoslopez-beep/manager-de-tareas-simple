import React, { useState, useEffect, useRef } from 'react';
import { X, Save, User, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useModalA11y } from '../useModalA11y';
import { updateUserDisplayName, changeUserPassword, translateFirebaseError } from '../firebase';

export default function ProfileModal({ isOpen, onClose, user, onUpdateProfile, onDeleteAccount }) {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const dialogRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  useModalA11y(isOpen, onClose, dialogRef);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setCurrentPassword('');
      setNewPassword('');
    }
    setShowDeleteConfirm(false);
    setDeletePassword('');
    setDeleteError('');
  }, [user, isOpen]);

  // Clear the pending "close after success" timeout if the component unmounts
  // (or the modal is closed some other way) before it fires.
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

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
      setErrorMsg('Para cambiar la contraseña, ingresa primero tu contraseña actual');
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
      closeTimeoutRef.current = setTimeout(() => {
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

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePassword.trim()) {
      setDeleteError('Ingresa tu contraseña para confirmar');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await onDeleteAccount(deletePassword.trim());
      // On success the parent logs the user out and this modal unmounts —
      // nothing left to reset here.
    } catch (err) {
      console.error('Error al eliminar la cuenta:', err);
      setDeleteError(translateFirebaseError(err));
      setDeleting(false);
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
            <div className="login-alert-success" style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="login-alert-error" style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <label htmlFor="profile-username" style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Nombre de la Cuenta:
            </label>
            <input
              id="profile-username"
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
              <label htmlFor="profile-current-password" style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '4px' }}>
                Contraseña Actual (para confirmar el cambio):
              </label>
              <input
                id="profile-current-password"
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

        {/* Danger Zone: permanent account deletion */}
        {onDeleteAccount && (
          <div style={{
            margin: '0 24px 24px 24px',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #fad2cf',
            backgroundColor: 'rgba(197, 34, 31, 0.06)'
          }}>
            {!showDeleteConfirm ? (
              <>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#c5221f', marginBottom: '4px' }}>
                  Eliminar cuenta
                </div>
                <p style={{ fontSize: '12px', color: 'var(--gmail-text-secondary)', margin: '0 0 10px 0' }}>
                  Borra tu cuenta y todas tus tareas de forma permanente. No se puede deshacer.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '16px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    color: '#c5221f',
                    backgroundColor: '#fce8e6'
                  }}
                >
                  <Trash2 size={14} />
                  <span>Eliminar mi cuenta y mis datos</span>
                </button>
              </>
            ) : (
              <form onSubmit={handleDeleteAccount}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#c5221f', marginBottom: '8px' }}>
                  Esto borrará tu cuenta y todas tus tareas para siempre. Ingresa tu contraseña para confirmar:
                </div>
                <input
                  type="password"
                  autoFocus
                  aria-label="Contraseña para confirmar eliminación"
                  placeholder="Tu contraseña actual..."
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #fad2cf',
                    backgroundColor: 'var(--gmail-bg)',
                    color: 'var(--gmail-text-primary)',
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}
                />
                {deleteError && (
                  <div style={{ fontSize: '12px', color: '#c5221f', marginBottom: '8px' }}>{deleteError}</div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '16px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: 'var(--gmail-text-secondary)',
                      backgroundColor: 'var(--gmail-hover)'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={deleting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '16px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      color: '#ffffff',
                      backgroundColor: '#c5221f'
                    }}
                  >
                    <Trash2 size={14} />
                    <span>{deleting ? 'Eliminando...' : 'Sí, eliminar todo'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
