import { useEffect, useState } from 'react';
import Modal from './Modal';
import { createCourse, getMe, isConfigured } from '../api/curriculum';
import type { CourseSummary } from '../api/curriculum';
import { setCourse } from '../state/course';
import { useCourse } from '../state/useCourse';

const NEW_COURSE = '__new__';

/**
 * Which course the instructor is working in. Labs and grades belong to a course, and the agents only
 * let an instructor into their own, so a new instructor has to create one before anything else works.
 * Hidden when the Curriculum Designer is not connected or predates courses: the default course is used.
 */
export default function CoursePicker() {
  const current = useCourse();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured()) return;
    let cancelled = false; // the instructor may sign out before the answer arrives
    getMe()
      .then(me => {
        if (cancelled) return;
        setCourses(me.courses);
        if (me.courses.length === 0) {
          setCreating(true);
        } else if (!me.courses.some(c => c.id === current.id)) {
          // The remembered or default course is not theirs: switch to one that is.
          setCourse(me.courses[0].id, me.courses[0].name);
        } else if (current.name === null) {
          setCourse(current.id, me.courses.find(c => c.id === current.id)?.name ?? null);
        }
      })
      .catch(() => { /* an agent without courses: keep the default one */ });
    return () => { cancelled = true; };
    // Only on first load: choosing a course remounts the dashboard, which loads this again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (courses === null) return null;

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const course = await createCourse(trimmed);
      setCourse(course.id, course.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  function onChange(value: string) {
    if (value === NEW_COURSE) {
      setCreating(true);
      return;
    }
    const course = courses?.find(c => c.id === value);
    if (course) setCourse(course.id, course.name);
  }

  return (
    <>
      {courses.length > 0 && (
        <select
          className="course-select"
          aria-label="Course"
          value={current.id}
          onChange={e => onChange(e.target.value)}
        >
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value={NEW_COURSE}>+ New course…</option>
        </select>
      )}
      {creating && (
        <Modal
          title={courses.length === 0 ? 'Create your first course' : 'New course'}
          onClose={() => { if (!busy && courses.length > 0) { setCreating(false); setError(null); } }}
        >
          <p className="modal-subtitle">
            Labs and grades belong to a course, and only you can see the courses you create.
          </p>
          <div className="llm-field">
            <label htmlFor="course-name">Course name</label>
            <input
              id="course-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void create(); }}
              placeholder="e.g. CSC 580"
              disabled={busy}
              autoFocus
            />
          </div>
          {error && <div className="notice notice-error">{error}</div>}
          <div className="modal-footer">
            {courses.length > 0 && (
              <button className="btn-outline" onClick={() => { setCreating(false); setError(null); }} disabled={busy}>
                Cancel
              </button>
            )}
            <button className="btn-primary" onClick={() => void create()} disabled={busy || name.trim() === ''}>
              {busy ? 'Creating…' : 'Create course'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
