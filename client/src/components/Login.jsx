import React, { useState } from 'react';
import { Lock, User, AlertCircle, ArrowRight, UserCheck, Mail } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../firebase';

export default function Login({ onLoginSuccess, onGuestLogin }) {
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result.user) {
        onLoginSuccess({
          name: result.user.displayName || result.user.email.split('@')[0],
          email: result.user.email,
          uid: result.user.uid,
          photoURL: result.user.photoURL
        });
      }
    } catch (err) {
      console.error('Error al iniciar sesión con Google:', err);
      setError('No se pudo iniciar sesión con Google: ' + (err.message || 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const inputVal = emailOrUser.trim();
    const passVal = password.trim();

    // If input is an email format or Firebase is preferred
    const isEmail = inputVal.includes('@');
    const emailToUse = isEmail ? inputVal : `${inputVal.toLowerCase().replace(/\s+/g, '')}@gmail-tasks.app`;

    try {
      let userObj = null;

      if (isRegistering) {
        try {
          const res = await registerWithEmail(emailToUse, passVal);
          userObj = { name: inputVal, email: res.user.email, uid: res.user.uid };
        } catch (firebaseErr) {
          // If Firebase fails, try local backend
          const localRes = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: inputVal, password: passVal })
          }).catch(() => null);

          if (localRes && localRes.ok) {
            const data = await localRes.json();
            userObj = data.user;
          } else {
            throw firebaseErr;
          }
        }
      } else {
        try {
          const res = await loginWithEmail(emailToUse, passVal);
          userObj = { name: inputVal, email: res.user.email, uid: res.user.uid };
        } catch (firebaseErr) {
          // Fallback to local backend
          const localRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: inputVal, password: passVal })
          }).catch(() => null);

          if (localRes && localRes.ok) {
            const data = await localRes.json();
            userObj = data.user;
          } else {
            throw firebaseErr;
          }
        }
      }

      if (userObj) {
        onLoginSuccess(userObj);
      }
    } catch (err) {
      console.error('Error de autenticación:', err);
      let errMsg = 'Credenciales o contraseña incorrectas.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        errMsg = 'Usuario o contraseña incorrectos. Si no tienes cuenta, presiona "Registrarse".';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'Ese correo/usuario ya está registrado. Intenta iniciar sesión.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'La contraseña debe tener al menos 6 caracteres.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
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

        {/* Google 1-Click Auth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: '#ffffff',
            color: '#3c4043',
            border: '1px solid #dadce0',
            padding: '12px 16px',
            borderRadius: '24px',
            fontSize: '14.5px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            marginBottom: '18px',
            transition: 'background-color 0.15s ease'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continuar con Google</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '18px', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--gmail-border)' }} />
          <span style={{ fontSize: '12px', color: 'var(--gmail-text-muted)', fontWeight: '500' }}>o correo / usuario</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--gmail-border)' }} />
        </div>

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
