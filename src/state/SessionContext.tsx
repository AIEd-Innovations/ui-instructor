// The signed-in instructor, their courses, and which lab is open.
//
// Every teacher used to see the same lab, because the course and lab came from
// fixed settings. They now come from the Curriculum Designer: `GET /me` says
// who the caller is and what they own, and `GET /courses/{id}/labs` lists one
// course's labs. The choice lives here, and is mirrored into `api/session.ts`
// so the plain API modules can read it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import * as api from '../api/curriculum';
import type { Course, LabSummary } from '../api/curriculum';
import * as session from '../api/session';
import { SessionContext } from './sessionStore';
import type { SessionState } from './sessionStore';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<SessionState['me']>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [labId, setLabId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The API modules read the selection synchronously when a request is built,
  // so it has to be written through as it changes, not in an effect afterwards.
  const chooseCourse = useCallback((next: Course | null) => {
    setCourse(next);
    session.setSelection({ courseId: next?.id ?? '' });
  }, []);

  const chooseLab = useCallback((next: string) => {
    setLabId(next);
    session.setSelection({ labId: next });
  }, []);

  const loadLabs = useCallback(async (courseId: string): Promise<LabSummary[]> => {
    if (!courseId) {
      setLabs([]);
      return [];
    }
    const { labs: found } = await api.listCourseLabs(courseId);
    setLabs(found);
    return found;
  }, []);

  /** Pick a course, load its labs, and open the most recent one. */
  const selectCourse = useCallback(
    async (courseId: string) => {
      const next = courses.find(c => c.id === courseId) ?? null;
      chooseCourse(next);
      chooseLab('');
      if (!next) return;
      setBusy(true);
      try {
        const found = await loadLabs(next.id);
        chooseLab(found[0]?.lab_id ?? '');
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setBusy(false);
      }
    },
    [courses, chooseCourse, chooseLab, loadLabs],
  );

  /** `GET /me`, then open the first course and its newest lab. */
  const load = useCallback(async () => {
    try {
      const mine = await api.getMe();
      setMe(mine.user);
      session.setIdentity({ email: mine.user.email, userId: mine.user.id });
      setCourses(mine.courses);
      setError(null);

      const first = mine.courses[0] ?? null;
      chooseCourse(first);
      chooseLab('');
      if (first) {
        const found = await loadLabs(first.id);
        chooseLab(found[0]?.lab_id ?? '');
      }
    } catch (err) {
      setError(messageOf(err));
    }
    setLoading(false);
  }, [chooseCourse, chooseLab, loadLabs]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // One fetch on mount. `load` only sets state after the request resolves.
    void load();
  }, [load]);

  const value = useMemo<SessionState>(
    () => ({
      me,
      courses,
      course,
      labs,
      labId,
      loading,
      error,
      busy,

      reload: async () => {
        setLoading(true);
        await load();
      },

      selectCourse,

      createCourse: async name => {
        setBusy(true);
        try {
          const created = await api.createCourse(name);
          setCourses(current => [...current, created]);
          chooseCourse(created);
          setLabs([]);
          chooseLab('');
          setError(null);
        } finally {
          setBusy(false);
        }
      },

      selectLab: chooseLab,
      startNewLab: () => chooseLab(''),

      ensureLabId: title => {
        if (labId) return labId;
        const fresh = session.newLabId(title);
        chooseLab(fresh);
        return fresh;
      },

      refreshLabs: async () => {
        if (!course) return;
        try {
          await loadLabs(course.id);
        } catch {
          // The list is a convenience; the open lab is what matters.
        }
      },
    }),
    [me, courses, course, labs, labId, loading, error, busy, load, selectCourse, chooseCourse, chooseLab, loadLabs],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
