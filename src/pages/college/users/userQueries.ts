import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UserSummary } from '@/api/colleges';
import { queryKeys } from '@/lib/queryClient';

export function userName(user: UserSummary): string {
  return user.fullName ?? user.loginId ?? user.email ?? 'This user';
}

/**
 * Refreshes the views a user change affects (UI spec F2.1): the user lists, that user's detail and
 * the subjects (which show professor names). After a removal the user's detail is dropped
 * instead, so an open detail page isn't refetched into a 404 on its way out.
 */
export function useRefreshUsers() {
  const client = useQueryClient();
  return useCallback(
    (removedId?: string) => {
      if (removedId) {
        client.removeQueries({ queryKey: queryKeys.collegeUsers.detail(removedId), exact: true });
        void client.invalidateQueries({ queryKey: queryKeys.collegeUsers.lists });
      } else {
        void client.invalidateQueries({ queryKey: queryKeys.collegeUsers.all });
      }
      void client.invalidateQueries({ queryKey: queryKeys.subjects.all });
    },
    [client],
  );
}
