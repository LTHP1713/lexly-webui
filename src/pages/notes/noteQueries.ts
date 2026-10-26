import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

/** Refreshes every note list of every role (UI spec F5c, "Data refresh"). */
export function useRefreshNotes() {
  const client = useQueryClient();
  return useCallback(() => void client.invalidateQueries({ queryKey: queryKeys.notes.all }), [client]);
}
