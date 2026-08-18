import { useEffect, useRef } from 'react';

// Accessibility behaviour shared by every modal dialog:
//   - moves focus into the dialog when it opens,
//   - closes on Escape,
//   - traps Tab focus inside the dialog,
//   - restores focus to the element that opened it when it closes.
// Pair with role="dialog", aria-modal="true", an aria-label/aria-labelledby, and
// tabIndex={-1} on the dialog container that `containerRef` points at.
export function useModalA11y(isOpen, onClose, containerRef) {
  const prevFocusRef = useRef(null);
  // Keep the latest onClose in a ref so it isn't an effect dependency. Callers pass an
  // inline arrow that changes identity every render; depending on it would re-run this
  // effect on every parent re-render, yanking focus back to the first element.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // On phones the floating compose FAB and bottom nav bar are fixed overlays
    // with a higher z-index than any dialog, so they'd sit on top of (and
    // swallow taps meant for) buttons near the bottom of an open modal —
    // notably the compose form's own "Crear Tarea" submit button.
    document.body.classList.add('modal-open');

    prevFocusRef.current = document.activeElement;
    const container = containerRef.current;

    const getFocusable = () => (container
      ? Array.from(container.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ))
      : []);

    // Focus the first interactive element, or the container itself as a fallback.
    const focusables = getFocusable();
    if (focusables.length > 0) focusables[0].focus();
    else if (container) container.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const items = getFocusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKeyDown);
      const prev = prevFocusRef.current;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [isOpen, containerRef]);
}
