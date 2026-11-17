// Context object and hook for the signed-in instructor, their courses and the
// lab they are working on. Kept apart from the provider component so the file
// exporting <SessionProvider> exports nothing else (react-refresh rule).

import { createContext, useContext } from 'react';
import type { Course, LabSummary } from '../api/curriculum';

export interface SessionState {
  /** Null until `GET /me` answers. */
  me: { id: string; email: string; name: string } | null;
  courses: Course[];
  /** The chosen course, or null while the instructor has none yet. */
  course: Course | null;
  labs: LabSummary[];
  /** The chosen lab's id. '' when the course has no labs, or a new one is being written. */
  labId: string;

  loading: boolean;
  /** Set when `/me` could not be loaded at all. */
  error: string | null;
  /** A course is being created or a lab list fetched. */
  busy: boolean;

  reload: () => Promise<void>;
  selectCourse: (courseId: string) => Promise<void>;
  createCourse: (name: string) => Promise<void>;
  selectLab: (labId: string) => void;
  /** Clear the chosen lab, so the dashboard offers to generate a new one. */
  startNewLab: () => void;
  /** Mint an id for a lab about to be generated, or return the chosen one. */
  ensureLabId: (title: string) => string;
  refreshLabs: () => Promise<void>;
}

export const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
