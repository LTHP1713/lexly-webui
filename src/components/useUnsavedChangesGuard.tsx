import { useCallback, useEffect } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Asks before leaving a form with unsaved changes: in-app navigation (links, back/forward)
 * through the router's blocker, and reload / tab close through `beforeunload`.
 * `ignoreSearch` lets a change of only the query string through (a view option on the same page
 * that keeps the form mounted). Returns the confirmation dialog to render.
 */
export function useUnsavedChangesGuard(dirty: boolean, { ignoreSearch = false }: { ignoreSearch?: boolean } = {}) {
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      dirty && (!ignoreSearch || currentLocation.pathname !== nextLocation.pathname),
    [dirty, ignoreSearch],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Leave without saving?"
      confirmLabel="Leave"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    >
      <p>Your changes on this page haven't been saved and will be lost.</p>
    </ConfirmDialog>
  );
}
