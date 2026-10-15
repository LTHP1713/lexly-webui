import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

/**
 * Refreshes every view of the professor's assessments after a save, publish or remove (UI spec
 * F3 shell), plus the subjects (their `assessmentCount`). `deletedId` drops that assessment's
 * detail and grid instead, so a page on its way out isn't refetched into a 404.
 */
export function useRefreshAssessments() {
  const client = useQueryClient();
  return useCallback(
    (deletedId?: string) => {
      if (deletedId) {
        client.removeQueries({ queryKey: queryKeys.professorAssessments.detail(deletedId) });
        void client.invalidateQueries({ queryKey: queryKeys.professorAssessments.lists });
      } else {
        void client.invalidateQueries({ queryKey: queryKeys.professorAssessments.all });
      }
      void client.invalidateQueries({ queryKey: queryKeys.subjects.all });
    },
    [client],
  );
}
