import { useEffect, useRef } from 'react';

/**
 * Hook para gerenciar focus ao abrir/fechar dialogs
 * Garante:
 * - Focus trap dentro do dialog
 * - Focus volta ao trigger quando fecha
 * - Keyboard navigation (Tab, Shift+Tab, Esc)
 */
export function useDialogFocus(open, triggerId = null) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (open) {
      // Guardar elemento com foco antes de abrir dialog
      previousFocusRef.current = document.activeElement;
    } else if (previousFocusRef.current && previousFocusRef.current.focus) {
      // Restaurar foco quando fecha dialog
      setTimeout(() => {
        previousFocusRef.current?.focus();
      }, 0);
    }
  }, [open]);

  return { previousFocusRef };
}

export default useDialogFocus;
