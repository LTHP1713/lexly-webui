import { useCallback, useEffect, useState } from 'react';
import styles from './ui.module.css';

const TOAST_MS = 4000;

/**
 * Short-lived success message. The live region stays mounted so screen readers announce each
 * new message; `id` changes even when the text repeats (saving twice in a row).
 */
export function useToast() {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Stable, so callers can use it in effect dependencies.
  const show = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  return {
    show,
    element: (
      <div role="status" aria-live="polite" className={styles.toastRegion}>
        {toast && (
          <p key={toast.id} className={styles.toast}>
            {toast.message}
          </p>
        )}
      </div>
    ),
  };
}
