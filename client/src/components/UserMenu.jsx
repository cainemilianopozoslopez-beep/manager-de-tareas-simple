import React from 'react';
import { Sun, Moon, LogOut, Settings, Bell, ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';

export default function UserMenu({
  user,
  theme,
  onToggleTheme,
  onOpenProfileModal,
  onOpenSettings,
  onLogout,
  onClose
}) {
  const isGuest = Boolean(user?.isGuest);
  const userLetter = isGuest ? 'I' : (user?.username ? user.username.charAt(0).toUpperCase() : 'C');

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '48px',
        right: '0',
        width: '310px',
        backgroundColor: 'var(--pulse-surface-elevated, var(--pulse-surface))',
        borderRadius: '16px',
        boxShadow: 'var(--pulse-shadow)',
        border: '1px solid var(--pulse-border)',
        zIndex: 200,
        overflow: 'hidden',
        padding: '16px'
      }}
      className="animate-fade-in"
    >
      {/* Account Info Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--pulse-border)'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: isGuest ? '#f59e0b' : 'var(--pulse-q1-accent)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '20px'
        }}>
          {userLetter}
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--pulse-text-primary)' }}>
            {user?.username || 'Usuario'}
          </div>
          <div style={{ fontSize: '12px', color: isGuest ? '#f59e0b' : 'var(--pulse-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isGuest ? (
              <>
                <UserCheck size={13} color="#f59e0b" />
                <strong>Modo Invitado (Temporal)</strong>
              </>
            ) : (
              <>
                <ShieldCheck size={13} color="var(--pulse-accent)" /> Cuenta Activa
              </>
            )}
          </div>
        </div>
      </div>

      {/* Guest Warning Banner */}
      {isGuest && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#f59e0b',
          borderRadius: '10px',
          padding: '8px 10px',
          fontSize: '11.5px',
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span>Las tareas de este modo se borrarán al cerrar la pestaña.</span>
        </div>
      )}

      {/* Menu Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
        
        {/* Theme Switcher Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderRadius: '12px',
          backgroundColor: 'var(--pulse-sidebar-bg)',
          fontSize: '13px',
          fontWeight: '500',
          color: 'var(--pulse-text-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {theme === 'dark' ? <Moon size={17} color="var(--pulse-accent)" /> : <Sun size={17} color="#f59e0b" />}
            <span>Tema: <strong>{theme === 'dark' ? 'Oscuro 🌙' : 'Claro ☀️'}</strong></span>
          </div>

          <button
            onClick={onToggleTheme}
            style={{
              backgroundColor: 'var(--pulse-active-tab)',
              color: 'var(--pulse-accent)',
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '12px',
              fontWeight: '700'
            }}
          >
            Cambiar
          </button>
        </div>

        {/* Notification schedule & backup */}
        <button
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            fontSize: '13.5px',
            fontWeight: '500',
            color: 'var(--pulse-text-primary)',
            width: '100%',
            textAlign: 'left'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--pulse-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Bell size={18} color="var(--pulse-accent)" />
          <span>Notificaciones y Respaldo</span>
        </button>

        {/* Profile Settings Option (Only if not guest) */}
        {!isGuest && (
          <button
            onClick={() => {
              onClose();
              onOpenProfileModal();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '12px',
              fontSize: '13.5px',
              fontWeight: '500',
              color: 'var(--pulse-text-primary)',
              width: '100%',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--pulse-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Settings size={18} color="var(--pulse-accent)" />
            <span>Configuración de Cuenta</span>
          </button>
        )}

        {/* Logout / Exit Guest Option */}
        <button
          onClick={() => {
            onClose();
            onLogout();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            fontSize: '13.5px',
            fontWeight: '500',
            color: 'var(--pulse-q1-accent)',
            width: '100%',
            textAlign: 'left'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--pulse-q1-bg)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <LogOut size={18} color="var(--pulse-q1-accent)" />
          <span>{isGuest ? 'Salir del Modo Invitado' : 'Cerrar Sesión'}</span>
        </button>

      </div>
    </div>
  );
}
