import React, { useCallback, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// Dictation button backed by the browser's native Web Speech API — no server,
// no API key, no cost. Unsupported browsers (Firefox, most non-Chromium
// engines) get no button at all rather than a broken one.
export default function MicButton({ onResult, label = 'Dictar por voz', lang = 'es-MX', size = 16, style }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI || listening) return;
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
    // onend always fires after onerror, so a single place clears the listening state.
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [lang, listening, onResult]);

  if (!SpeechRecognitionAPI) return null;

  return (
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
        flexShrink: 0,
        ...style
      }}
    >
      {listening ? <MicOff size={size} /> : <Mic size={size} />}
    </button>
  );
}
