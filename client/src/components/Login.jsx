import React, { useState } from 'react';
import { Lock, User, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { loginWithEmail, registerWithEmail } from '../firebase';

export default function Login({ onLoginSuccess, onGuestLogin }) {
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const inputVal = emailOrUser.trim();
    if (!inputVal) {
      setError('Por favor ingresa tu nombre de cuenta o usuario.');
      return;
    }

    onLoginSuccess({ username: inputVal, isGuest: false, theme: 'light' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: 'var(--gmail-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '450px',
        backgroundColor: 'var(--gmail-surface)',
        borderRadius: '24px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
        border: '1px solid var(--gmail-border)',
        padding: '40px 36px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }} className="animate-fade-in">
        
        {/* Google / Gmail Branding Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
            <path d="M4 24V10L16 19L28 10V24C28 25.1 27.1 26 26 26H6C4.9 26 4 25.1 4 24Z" fill="#EA4335"/>
            <path d="M28 10L16 19L4 10V8C4 6.9 4.9 6 6 6H26C27.1 6 28 6.9 28 8V10Z" fill="#4285F4"/>
            <path d="M4 10L16 19V26H6C4.9 26 4 25.1 4 24V10Z" fill="#34A853"/>
            <path d="M28 10L16 19V26H26C27.1 26 28 25.1 28 24V10Z" fill="#FBBC05"/>
          </svg>
          <span style={{ fontSize: '24px', fontWeight: '600', color: 'var(--gmail-text-primary)' }}>
            Gmail Tasks
          </span>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '500', color: 'var(--gmail-text-primary)', marginBottom: '8px', textAlign: 'center' }}>
          Iniciar Sesión
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--gmail-text-secondary)', marginBottom: '24px', textAlign: 'center' }}>
          Ingresa con tu cuenta o entra en Modo Invitado temporal
        </p>

        {/* Error Alert */}
        {error && (
          <div style={{
            width: '100%',
            backgroundColor: '#fce8e6',
            color: '#c5221f',
            border: '1px solid #fad2cf',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Account Username or Email */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Nombre de Cuenta / Correo:
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={18} color="var(--gmail-text-muted)" style={{ position: 'absolute', left: '14px' }} />
              <input
                type="text"
                placeholder="Ej: Caín o cain@gmail.com"
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  border: '1px solid var(--gmail-border)',
                  backgroundColor: 'var(--gmail-bg)',
                  color: 'var(--gmail-text-primary)',
                  fontSize: '15px',
                  fontWeight: '500'
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gmail-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Contraseña:
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={18} color="var(--gmail-text-muted)" style={{ position: 'absolute', left: '14px' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  border: '1px solid var(--gmail-border)',
                  backgroundColor: 'var(--gmail-bg)',
                  color: 'var(--gmail-text-primary)',
                  fontSize: '15px',
                  fontWeight: '500'
                }}
              />
            </div>
          </div>

          {/* Toggle Register Mode */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
            <button
              type="button"
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              style={{ fontSize: '12.5px', color: 'var(--gmail-blue)', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Registrate'}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#1a73e8',
              color: '#ffffff',
              padding: '13px',
              borderRadius: '24px',
              fontSize: '15px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px',
              boxShadow: '0 2px 6px rgba(26,115,232,0.3)',
              opacity: loading ? 0.7 : 1,
              cursor: 'pointer'
            }}
          >
            <span>{loading ? 'Procesando...' : isRegistering ? 'Crear Cuenta' : 'Acceder con Cuenta'}</span>
            {!loading && <ArrowRight size={18} />}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--gmail-border)' }} />
            <span style={{ fontSize: '12px', color: 'var(--gmail-text-muted)', fontWeight: '500' }}>o también</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--gmail-border)' }} />
          </div>

          {/* Guest Mode Button */}
          <button
            type="button"
            onClick={onGuestLogin}
            style={{
              width: '100%',
              backgroundColor: 'var(--gmail-hover)',
              color: 'var(--gmail-text-primary)',
              border: '1px solid var(--gmail-border)',
              padding: '12px',
              borderRadius: '24px',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              cursor: 'pointer'
            }}
          >
            <UserCheck size={18} color="var(--gmail-blue)" />
            <span>Acceder como Invitado 👤</span>
          </button>

          <p style={{ fontSize: '11.5px', color: 'var(--gmail-text-muted)', textAlign: 'center', margin: '2px 0 0 0' }}>
            * En <strong>Modo Invitado</strong> no necesitas cuenta. Todo lo que hagas se borrará automáticamente al cerrar la página.
          </p>

        </form>

      </div>
    </div>
  );
}
