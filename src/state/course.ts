// The course the instructor is working in. Every lab and every grade belongs to a course, and the
// agents only let an instructor touch their own, so each request names one (`course_id`).
//
// The choice is not secret, so it is remembered for the browser session. Before an instructor has
// picked one (or when the agents have no sign-in), it is VITE_COURSE_ID, or csc580.

export const DEFAULT_COURSE_ID: string = import.meta.env.VITE_COURSE_ID ?? 'csc580';

const STORAGE_KEY = 'course';

export interface CurrentCourse {
  id: string;
  /** Shown in the header. Unknown until the course list has loaded. */
  name: string | null;
}

function readStored(): CurrentCourse {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CurrentCourse>;
      if (typeof parsed.id === 'string' && parsed.id) {
        return { id: parsed.id, name: typeof parsed.name === 'string' ? parsed.name : null };
      }
    }
  } catch {
    /* storage unavailable or damaged: use the default */
  }
  return { id: DEFAULT_COURSE_ID, name: null };
}

let current: CurrentCourse = readStored();
const listeners = new Set<() => void>();

export function getCourse(): CurrentCourse {
  return current;
}

export function getCourseId(): string {
  return current.id;
}

export function subscribeCourse(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Switch course. Does nothing when nothing would change, so subscribers do not reload for no reason. */
export function setCourse(id: string, name: string | null = null): void {
  if (current.id === id && current.name === name) return;
  current = { id, name };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* the choice just will not be remembered */
  }
  listeners.forEach(listener => listener());
}

/** `path` with this course's id on the query string, unless it already names one. */
export function withCourse(path: string, courseId: string = current.id): string {
  if (/[?&]course_id=/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}course_id=${encodeURIComponent(courseId)}`;
}
