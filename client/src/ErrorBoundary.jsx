import React from 'react';

// Catches render-time errors anywhere below it so a crash shows a recoverable
// message instead of a blank white page. Does not catch errors in event
// handlers or async code (React never routes those here) — those are handled
// with their own try/catch + toast where they occur.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Error no capturado en la interfaz:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px',
        textAlign: 'center',
        fontFamily: "'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundColor: 'var(--pulse-bg, #f8fafc)',
        color: 'var(--pulse-text-primary, #0f172a)'
      }}>
        <div style={{ fontSize: '40px' }}>⚠️</div>
        <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
          Algo salió mal
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--pulse-text-secondary, #475569)', maxWidth: '360px', margin: 0 }}>
          Ocurrió un error inesperado en la aplicación. Tus tareas guardadas no se perdieron — recarga la página para continuar.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: '8px',
            padding: '10px 24px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: 'var(--pulse-accent, #3b82f6)',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Recargar página
        </button>
      </div>
    );
  }
}
