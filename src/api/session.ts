// Which course and lab the instructor is working on, and who they are.
//
// This used to come from fixed settings (VITE_COURSE_ID, VITE_LAB_ID,
// VITE_INSTRUCTOR_ID, VITE_ASSIGNMENT_ID), so every teacher saw the same lab.
// It is now chosen in the dashboard: <SessionProvider> owns the React state
// and writes it through to here, so the plain API modules — which are not
// components and cannot read a context — can still reach it.
//
// Nothing is persisted. A reload re-reads `GET /me` and the instructor picks
// again, which also means a signed-out tab holds no course.

export interface Selection {
  courseId: string;
  labId: string;
}

export interface SessionIdentity {
  /** The signed-in instructor's email, recorded by the agents as who acted. */
  email: string;
  /** Their id in the shared `users` collection, from `GET /me`. */
  userId: string;
}

let selection: Selection = { courseId: '', labId: '' };
let identity: SessionIdentity = { email: '', userId: '' };

export function setSelection(next: Partial<Selection>): void {
  selection = { ...selection, ...next };
}

export function setIdentity(next: Partial<SessionIdentity>): void {
  identity = { ...identity, ...next };
}

/** Forget everything on sign-out: the next instructor must not inherit a course. */
export function clearSession(): void {
  selection = { courseId: '', labId: '' };
  identity = { email: '', userId: '' };
}

export const courseId = (): string => selection.courseId;
export const labId = (): string => selection.labId;
export const instructorEmail = (): string => identity.email;
export const userId = (): string => identity.userId;

/** An assignment's id is its lab's id, so the Assessment Agent needs no picker of its own. */
export const assignmentId = (): string => selection.labId;

/** True once a course and a lab are both chosen — until then the tabs have nothing to show. */
export const hasLab = (): boolean => selection.courseId !== '' && selection.labId !== '';

/** A fresh lab id: readable, and unique enough that two instructors never collide. */
export function newLabId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug || 'lab'}-${suffix}`;
}

// ── Signed out mid-session ───────────────────────────────────────────────────
//
// A token expires while the dashboard is open and the next request comes back
// 401. The API modules report it here; <App> registers a handler that returns
// the instructor to the sign-in page with "Your sign-in expired".

type SignedOutHandler = () => void;

let signedOutHandler: SignedOutHandler | null = null;

export function onSignedOut(handler: SignedOutHandler | null): void {
  signedOutHandler = handler;
}

export function reportSignedOut(): void {
  signedOutHandler?.();
}
