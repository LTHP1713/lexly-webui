import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

/**
 * Refreshes every view of subjects (UI spec F2.1); `removedId` drops that subject's detail
 * instead, so an open detail page isn't refetched into a 404 on its way out.
 */
export function useRefreshSubjects() {
  const client = useQueryClient();
  return useCallback(
    (removedId?: string) => {
      if (removedId) {
        client.removeQueries({ queryKey: queryKeys.subjects.detail(removedId), exact: true });
        void client.invalidateQueries({ queryKey: queryKeys.subjects.lists });
      } else {
        void client.invalidateQueries({ queryKey: queryKeys.subjects.all });
      }
    },
    [client],
  );
}
