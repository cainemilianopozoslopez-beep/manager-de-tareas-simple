import React, { useCallback, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// Web Speech API error codes: https://developer.mozilla.org/docs/Web/API/SpeechRecognitionErrorEvent/error
const ERROR_MESSAGES = {
  'not-allowed': 'Permiso de micrófono denegado',
  'service-not-allowed': 'Permiso de micrófono denegado',
  'no-speech': 'No se detectó voz',
  'audio-capture': 'No se encontró micrófono',
  'network': 'Error de red al reconocer voz'
};

// Dictation button backed by the browser's native Web Speech API — no server,
// no API key, no cost. Unsupported browsers (Firefox, most non-Chromium
// engines) get no button at all rather than a broken one.
export default function MicButton({ onResult, label = 'Dictar por voz', lang = 'es-MX', size = 16, style }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const errorTimeoutRef = useRef(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI || listening) return;
    setError(null);
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const text = Array.from(e.results)
        .map(r => r[0].transcript)
        .join(' ')
        .trim();
      if (text) onResult(text);
    };
    recognition.onerror = (e) => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      setError(ERROR_MESSAGES[e.error] || 'No se pudo reconocer la voz');
      errorTimeoutRef.current = setTimeout(() => setError(null), 3500);
    };
    // onend always fires after onerror, so a single place clears the listening state.
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [lang, listening, onResult]);

  if (!SpeechRecognitionAPI) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', ...style }}>
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-label={listening ? 'Detener dictado por voz' : label}
        title={listening ? 'Detener dictado por voz' : label}
        className={listening ? 'mic-btn-listening' : ''}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5px',
          borderRadius: '50%',
          color: listening ? '#ef4444' : 'var(--pulse-text-muted)',
          backgroundColor: listening ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
          flexShrink: 0
        }}
      >
        {listening ? <MicOff size={size} /> : <Mic size={size} />}
      </button>
      {error && (
        <span
          role="alert"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '6px',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            color: '#ffffff',
            backgroundColor: '#ef4444',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 10
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
