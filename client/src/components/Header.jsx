import React, { useState, useEffect, useRef } from 'react';
import { Menu, Search, X, Settings, Eye, Clock, Bell } from 'lucide-react';
import UserMenu from './UserMenu';

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  onOpenSettings, 
  onOpenPreview,
  onTriggerNotification,
  settings,
  notificationPermission, 
  onRequestPermission,
  user,
  theme,
  onToggleTheme,
  onOpenProfileModal,
  onLogout,
  onToggleSidebar
}) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userLetter = user?.username ? user.username.charAt(0).toUpperCase() : 'C';
  const isGuest = Boolean(user?.isGuest);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  return (
    <header style={{
      height: '64px',
      backgroundColor: 'var(--gmail-surface)',
      borderBottom: '1px solid var(--gmail-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      gap: '16px',
      zIndex: 10,
      position: 'relative'
    }}>
      {/* Left Branding */}
      <div className="app-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px' }}>
        <button
          title="Abrir menú"
          className="app-header-menu-btn"
          onClick={onToggleSidebar}
          style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', color: 'var(--gmail-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gmail-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Official Gmail Icon SVG */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M4 24V10L16 19L28 10V24C28 25.1 27.1 26 26 26H6C4.9 26 4 25.1 4 24Z" fill="#EA4335"/>
            <path d="M28 10L16 19L4 10V8C4 6.9 4.9 6 6 6H26C27.1 6 28 6.9 28 8V10Z" fill="#4285F4"/>
            <path d="M4 10L16 19V26H6C4.9 26 4 25.1 4 24V10Z" fill="#34A853"/>
            <path d="M28 10L16 19V26H26C27.1 26 28 25.1 28 24V10Z" fill="#FBBC05"/>
          </svg>
          <span style={{ fontSize: '20px', fontWeight: '500', color: 'var(--gmail-text-primary)', letterSpacing: '-0.3px' }}>
            Tasks <span className="app-header-optional" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gmail-red)', backgroundColor: 'var(--gmail-hover)', padding: '2px 8px', borderRadius: '12px', marginLeft: '4px' }}>Gmail Edition</span>
          </span>
        </div>
      </div>

      {/* Middle Gmail Search Bar */}
      <div style={{
        flex: 1,
        maxWidth: '620px',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--gmail-search-bg)',
          borderRadius: '24px',
          padding: '0 16px',
          height: '44px',
          transition: 'all 0.2s ease',
          border: searchQuery ? '1px solid var(--gmail-blue)' : '1px solid transparent'
        }}>
          <Search size={18} color="var(--gmail-text-muted)" style={{ marginRight: '12px' }} />
          <input
            id="task-search-input"
            type="text"
            placeholder="Buscar tareas por título o descripción... ( / )"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '15px',
              color: 'var(--gmail-text-primary)'
            }}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ padding: '4px', borderRadius: '50%', color: 'var(--gmail-text-secondary)' }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Right Controls & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        
        {/* Schedule Badge (server-side setting, not applicable to Guest Mode) */}
        {!isGuest && (
          <div
            className="app-header-optional"
            onClick={onOpenSettings}
            title="Haz clic para cambiar la hora de notificación o email"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--gmail-hover)',
              color: 'var(--gmail-text-primary)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              border: '1px solid var(--gmail-border)'
            }}
          >
            <Clock size={14} color="var(--gmail-blue)" />
            <span>Recordatorio: <strong>{settings?.scheduledTime || '08:00'}</strong></span>
          </div>
        )}

        {/* Trigger Desktop Notification Button */}
        <button
          onClick={notificationPermission === 'granted' ? onTriggerNotification : onRequestPermission}
          title={notificationPermission === 'granted' ? 'Enviar una notificación de escritorio de prueba ahora' : 'Solicitar permiso para notificaciones en el navegador'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: notificationPermission === 'granted' ? '#1a73e8' : '#feefc3',
            color: notificationPermission === 'granted' ? '#ffffff' : '#b06000',
            padding: '7px 14px',
            borderRadius: '18px',
            fontSize: '12.5px',
            fontWeight: '600',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            transition: 'all 0.15s'
          }}
        >
          <Bell size={15} />
          <span>
            {notificationPermission === 'granted' ? 'Notificación Escritorio 🔔' : 'Activar Notificaciones 🔔'}
          </span>
        </button>

        {/* Email Preview Button (previews real server-side tasks, not applicable to Guest Mode) */}
        {!isGuest && (
          <button
            className="app-header-optional"
            onClick={onOpenPreview}
            title="Ver plantilla de correo HTML"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--gmail-hover)',
              color: 'var(--gmail-text-primary)',
              padding: '7px 12px',
              borderRadius: '18px',
              fontSize: '12.5px',
              fontWeight: '500'
            }}
          >
            <Eye size={15} />
            <span>Email</span>
          </button>
        )}

        {/* Settings Button (server-side account settings, not applicable to Guest Mode) */}
        {!isGuest && (
          <button
            onClick={onOpenSettings}
            title="Configuración de Notificaciones y Gmail"
            style={{
              padding: '9px',
              borderRadius: '50%',
              color: 'var(--gmail-text-secondary)',
              display: 'flex',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gmail-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Settings size={20} />
          </button>
        )}

        {/* User Profile Avatar (Clickable Menu) */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            title={`Cuenta de ${user?.username || 'Caín'} - Haz clic para ver opciones`}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#ea4335',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '16px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              cursor: 'pointer',
              border: '2px solid transparent',
              transition: 'transform 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {userLetter}
          </button>

          {/* Render User Menu */}
          {isUserMenuOpen && (
            <UserMenu
              user={user}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onOpenProfileModal={onOpenProfileModal}
              onLogout={onLogout}
              onClose={() => setIsUserMenuOpen(false)}
            />
          )}
        </div>

      </div>
    </header>
  );
}
