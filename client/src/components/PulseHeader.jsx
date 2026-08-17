import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Search,
  Plus,
  Moon,
  Sun,
  Menu,
  X,
  LayoutGrid,
  List,
  Calendar,
  BarChart2
} from 'lucide-react';
import UserMenu from './UserMenu';

export default function PulseHeader({
  searchQuery,
  onSearchChange,
  onOpenCompose,
  onOpenSettings,
  onOpenPreview,
  onOpenProfile,
  theme,
  onToggleTheme,
  user,
  onLogout,
  onToggleSidebar,
  activeView, // 'matrix' | 'list' | 'calendar' | 'stats'
  onChangeView,
  completedCount = 0,
  totalCount = 0
}) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const isGuest = Boolean(user?.isGuest);
  const userLetter = isGuest ? 'I' : (user?.username ? user.username.charAt(0).toUpperCase() : 'C');

  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  // SVG Circle calculations for Pulse Ring
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

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
      backgroundColor: 'var(--pulse-surface)',
      borderBottom: '1px solid var(--pulse-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
    }}>
      {/* Left: Brand & Sidebar Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={onToggleSidebar}
          aria-label="Abrir menú lateral"
          className="app-header-menu-btn"
          style={{
            padding: '8px',
            borderRadius: '8px',
            color: 'var(--pulse-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => onChangeView('matrix')}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <Zap size={20} fill="#ffffff" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontSize: '17px',
              fontWeight: '700',
              letterSpacing: '-0.4px',
              color: 'var(--pulse-text-primary)',
              lineHeight: '1.1'
            }}>
              Pulse<span style={{ color: 'var(--pulse-accent)' }}>Matrix</span>
            </span>
            <span style={{
              fontSize: '10.5px',
              color: 'var(--pulse-text-muted)',
              fontWeight: '500',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              Productivity Hub
            </span>
          </div>
        </div>
      </div>

      {/* Center: Search & Pulse Progress Ring */}
      <div style={{ flex: 1, maxWidth: '440px', display: 'flex', alignItems: 'center', gap: '16px' }} className="app-header-search-container">
        {/* Search Bar */}
        <div style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Search size={17} style={{
            position: 'absolute',
            left: '14px',
            color: 'var(--pulse-text-muted)',
            pointerEvents: 'none'
          }} />
          <input
            id="task-search-input"
            type="text"
            placeholder="Buscar tareas (presiona /)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              paddingLeft: '40px',
              paddingRight: searchQuery ? '36px' : '65px',
              borderRadius: '20px',
              border: '1px solid var(--pulse-border)',
              backgroundColor: 'var(--pulse-sidebar-bg)',
              color: 'var(--pulse-text-primary)',
              fontSize: '13.5px',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '12px',
                color: 'var(--pulse-text-muted)',
                padding: '4px',
                borderRadius: '50%'
              }}
            >
              <X size={15} />
            </button>
          ) : (
            <span style={{
              position: 'absolute',
              right: '12px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--pulse-surface)',
              border: '1px solid var(--pulse-border)',
              color: 'var(--pulse-text-muted)',
              pointerEvents: 'none'
            }}>
              /
            </span>
          )}
        </div>

        {/* Pulse Progress Ring */}
        <div
          title={`Progreso de hoy: ${completedCount} de ${totalCount} tareas completadas (${percent}%)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px 12px',
            borderRadius: '20px',
            backgroundColor: 'var(--pulse-sidebar-bg)',
            border: '1px solid var(--pulse-border)',
            whiteSpace: 'nowrap'
          }}
          className="app-header-optional"
        >
          <div style={{ position: 'relative', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="38" height="38" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r={radius}
                fill="transparent"
                stroke="var(--pulse-border)"
                strokeWidth="3.5"
              />
              <circle
                cx="20"
                cy="20"
                r={radius}
                fill="transparent"
                stroke="var(--pulse-accent)"
                strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 0.5s ease',
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%'
                }}
              />
            </svg>
            <span style={{
              position: 'absolute',
              fontSize: '10.5px',
              fontWeight: '700',
              color: 'var(--pulse-text-primary)'
            }}>
              {percent}%
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--pulse-text-primary)' }}>
              Pulso Diario
            </span>
            <span style={{ fontSize: '11px', color: 'var(--pulse-text-muted)' }}>
              {completedCount}/{totalCount} hechas
            </span>
          </div>
        </div>
      </div>

      {/* Right: View Switcher & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* View Switcher Segmented Control */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--pulse-sidebar-bg)',
          padding: '3px',
          borderRadius: '10px',
          border: '1px solid var(--pulse-border)'
        }} className="app-header-optional">
          <button
            onClick={() => onChangeView('matrix')}
            title="Matriz Eisenhower (2x2)"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeView === 'matrix' ? 'var(--pulse-surface)' : 'transparent',
              color: activeView === 'matrix' ? 'var(--pulse-accent)' : 'var(--pulse-text-secondary)',
              boxShadow: activeView === 'matrix' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutGrid size={15} />
            Matriz
          </button>
          <button
            onClick={() => onChangeView('list')}
            title="Vista de Lista Inteligente"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeView === 'list' ? 'var(--pulse-surface)' : 'transparent',
              color: activeView === 'list' ? 'var(--pulse-accent)' : 'var(--pulse-text-secondary)',
              boxShadow: activeView === 'list' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <List size={15} />
            Lista
          </button>
          <button
            onClick={() => onChangeView('calendar')}
            title="Vista de Calendario"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeView === 'calendar' ? 'var(--pulse-surface)' : 'transparent',
              color: activeView === 'calendar' ? 'var(--pulse-accent)' : 'var(--pulse-text-secondary)',
              boxShadow: activeView === 'calendar' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Calendar size={15} />
            Calendario
          </button>
          <button
            onClick={() => onChangeView('stats')}
            title="Estadísticas de Productividad"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeView === 'stats' ? 'var(--pulse-surface)' : 'transparent',
              color: activeView === 'stats' ? 'var(--pulse-accent)' : 'var(--pulse-text-secondary)',
              boxShadow: activeView === 'stats' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <BarChart2 size={15} />
            Métricas
          </button>
        </div>

        {/* Primary "+ Nueva Tarea" Button */}
        <button
          onClick={() => onOpenCompose()}
          style={{
            height: '38px',
            padding: '0 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--pulse-accent)',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
            transition: 'transform 0.15s ease, background-color 0.15s ease'
          }}
        >
          <Plus size={18} />
          <span>Nueva Tarea</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'var(--pulse-sidebar-bg)',
            border: '1px solid var(--pulse-border)',
            color: 'var(--pulse-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease'
          }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User Menu Trigger & Popover Dropdown */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsUserMenuOpen(prev => !prev)}
            title="Opciones de cuenta de usuario"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: isGuest ? '#f29900' : 'var(--pulse-q1-accent)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--pulse-surface)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
          >
            {userLetter}
          </button>

          {isUserMenuOpen && (
            <UserMenu
              user={user}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onOpenProfileModal={onOpenProfile}
              onLogout={onLogout}
              onClose={() => setIsUserMenuOpen(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
}
