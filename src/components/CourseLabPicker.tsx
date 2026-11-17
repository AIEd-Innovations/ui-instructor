// The course and lab pickers in the header, and the first-course form a brand
// new instructor sees. Each instructor owns their own courses, so these are
// what decide which lab the whole dashboard is looking at.

import { useState } from 'react';

import Modal from './Modal';
import { useSession } from '../state/sessionStore';

const NEW_COURSE = '__new__';
const NEW_LAB = '__new__';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Name a course and create it. Used for the first one and for every one after. */
export function NewCourseForm({
  onDone,
  onCancel,
  heading,
  blurb,
}: {
  onDone?: () => void;
  onCancel?: () => void;
  heading: string;
  blurb: string;
}) {
  const { createCourse, busy } = useSession();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setError(null);
    try {
      await createCourse(trimmed);
      onDone?.();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <div className="course-form">
      <h2>{heading}</h2>
      <p>{blurb}</p>
      {error && <div className="notice notice-error">{error}</div>}
      <label htmlFor="course-name">Course name</label>
      <input
        id="course-name"
        value={name}
        placeholder="CSC 580"
        autoFocus
        onChange={event => setName(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') void submit();
        }}
      />
      <div className="course-form-actions">
        {onCancel && (
          <button className="btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <button className="btn-approve" onClick={() => void submit()} disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create course'}
        </button>
      </div>
    </div>
  );
}

/** Shown instead of the dashboard when `GET /me` comes back with no courses. */
export function FirstCourse() {
  return (
    <div className="first-course">
      <NewCourseForm
        heading="Create your first course"
        blurb="Labs live in a course, and a course is yours alone — nobody else can see or change it."
      />
    </div>
  );
}

export default function CourseLabPicker() {
  const { courses, course, labs, labId, selectCourse, selectLab, startNewLab, busy } = useSession();
  const [newCourse, setNewCourse] = useState(false);

  return (
    <>
      <div className="picker">
        <label className="picker-field">
          <span>Course</span>
          <select
            value={course?.id ?? ''}
            disabled={busy}
            onChange={event => {
              const value = event.target.value;
              if (value === NEW_COURSE) setNewCourse(true);
              else void selectCourse(value);
            }}
          >
            {courses.map(option => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            <option value={NEW_COURSE}>+ New course…</option>
          </select>
        </label>

        <label className="picker-field">
          <span>Lab</span>
          <select
            value={labId}
            disabled={busy || !course}
            onChange={event => {
              const value = event.target.value;
              if (value === NEW_LAB) startNewLab();
              else selectLab(value);
            }}
          >
            {labs.map(option => (
              <option key={option.lab_id} value={option.lab_id}>
                {option.title || option.lab_id}
                {option.approval_status === 'approved' ? ' ✓' : ''}
              </option>
            ))}
            {labId === '' && <option value="">New lab (not generated yet)</option>}
            <option value={NEW_LAB}>+ New lab…</option>
          </select>
        </label>
      </div>

      {newCourse && (
        <Modal title="New course" onClose={() => setNewCourse(false)}>
          <NewCourseForm
            heading="Create a course"
            blurb="It is yours alone: its labs are invisible to every other instructor."
            onDone={() => setNewCourse(false)}
            onCancel={() => setNewCourse(false)}
          />
        </Modal>
      )}
    </>
  );
}
