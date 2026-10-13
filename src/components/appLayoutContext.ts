import { useOutletContext } from 'react-router-dom';

/** What `AppLayout` passes to the pages it renders. */
export interface AppLayoutContext {
  /** Null when neither `GET /users/me` nor the login response supplies a name. */
  firstName: string | null;
}

/** For pages rendered inside `AppLayout` (e.g. the Home greeting), so `/users/me` is fetched once. */
export function useAppLayout(): AppLayoutContext {
  return useOutletContext<AppLayoutContext>();
}
