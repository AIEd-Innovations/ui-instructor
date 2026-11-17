// Direct client for the Curriculum Designer agent (no orchestrator — see #8).
//
// Set VITE_CURRICULUM_URL in .env (copy from .env.example). The agent runs on
// port 8003 locally. Types mirror models/curriculum.py and models/files.py in
// the curriculum-designer repo.

import { authHeaders } from '../auth/auth';
import { curriculumLlmHeaders } from './llmKey';
import { courseId, instructorEmail, labId as currentLabId, reportSignedOut } from './session';

const BASE: string = import.meta.env.VITE_CURRICULUM_URL ?? '';

export const isConfigured = (): boolean => BASE !== '';

const REQUEST_TIMEOUT_MS = 150_000;

// ── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'short_answer' | 'multiple_choice' | 'code' | 'essay';
export type DifficultyTier = 'basic' | 'intermediate' | 'challenge';
export type ApprovalStatus = 'pending' | 'approved' | 'needs_changes';
/** The three steps of a lab, in order. Each is approved before the next is generated. */
export type Step = 'spec' | 'quiz' | 'rubric';

export interface QuizQuestion {
  id: string;
  question: string;
  type: QuestionType;
  expected_answer: string;
  rubric_points: number;
  difficulty: DifficultyTier;
  learning_objective_ref: string | null;
}

export interface RubricCriterion {
  name: string;
  weight: number;
  description: string;
}

export interface Rubric {
  code_weight: number;
  report_weight: number;
  manual_weight: number;
  criteria: RubricCriterion[];
}

export interface FeedbackEntry {
  feedback: string;
  requested_by: string;
  requested_at: string;
  resulting_version: number;
  /** Which step the feedback was about; 'all' (or missing, on older labs) for the whole lab. */
  step?: Step | 'all';
}

export interface LabMaterial {
  lab_id: string;
  course_id: string;
  title: string;
  spec_markdown: string;
  quiz: QuizQuestion[];
  rubric: Rubric;
  learning_objectives: string[];
  difficulty: string;
  estimated_duration_min: number;
  material_weight: string;
  material_content: string | null;
  agent_instructions: string | null;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approval_notes: string | null;
  /** Absent on labs saved before step-by-step approval. */
  spec_status?: ApprovalStatus;
  quiz_status?: ApprovalStatus;
  rubric_status?: ApprovalStatus;
  feedback_history: FeedbackEntry[];
  version: number;
  generated_at: string;
  last_updated: string;
}

export interface LabFileSummary {
  file_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: 'material' | 'instructions';
  uploaded_by: string | null;
  uploaded_at: string;
  char_count: number;
}

export interface LabFileList {
  lab_id: string;
  course_id: string;
  files: LabFileSummary[];
  total_chars: number;
}

/** `GET /me` — who is signed in and which courses they own. */
export interface Me {
  user: { id: string; email: string; name: string };
  courses: Course[];
}

export interface Course {
  id: string;
  name: string;
}

/** One row of a course's lab list — metadata only, no spec or quiz. */
export interface LabSummary {
  lab_id: string;
  course_id: string;
  title: string;
  approval_status: ApprovalStatus;
  spec_status: ApprovalStatus;
  quiz_status: ApprovalStatus;
  rubric_status: ApprovalStatus;
  version: number;
  last_updated: string;
}

export interface GenerateParams {
  title: string;
  learning_objectives: string[];
  difficulty: string;
  estimated_duration_min: number;
  material_weight: 'strict' | 'balanced' | 'expansive';
}

// ── Plumbing ─────────────────────────────────────────────────────────────────

/** The agent returns { error: { code, message, agent } } on every non-2xx. */
export class AgentError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AgentError';
    this.code = code;
    this.status = status;
  }
}

/** A 401 from any agent: the ID token is missing, expired or rejected. */
export const SIGNED_OUT = 'SIGNED_OUT';
/** A 403: the course belongs to another instructor. */
export const NOT_YOUR_COURSE = 'NOT_YOUR_COURSE';

async function toAgentError(res: Response): Promise<AgentError> {
  let code = `HTTP_${res.status}`;
  let message = res.statusText || 'Request failed';
  if (res.status === 401) {
    // The agent's own text is for developers ("Invalid sign-in token: ...").
    reportSignedOut();
    return new AgentError('Your sign-in expired. Sign in again to continue.', SIGNED_OUT, 401);
  }
  if (res.status === 403) {
    return new AgentError('This course belongs to another instructor.', NOT_YOUR_COURSE, 403);
  }
  try {
    const body = await res.json();
    // FastAPI nests the envelope under "detail" for raised HTTPExceptions
    const error = body?.error ?? body?.detail?.error;
    if (error) {
      code = error.code ?? code;
      message = error.message ?? message;
    }
  } catch {
    /* response had no JSON body — keep the status text */
  }
  return new AgentError(message, code, res.status);
}

/**
 * `usesModel` marks calls that make the agent call an LLM; only those carry the instructor's
 * API key and model, so the key is not sent with plain reads and uploads.
 */
async function request<T>(path: string, init?: RequestInit, usesModel = false): Promise<T> {
  if (!BASE) {
    throw new AgentError(
      'VITE_CURRICULUM_URL is not set — the UI does not know where the Curriculum Designer is running.',
      'NOT_CONFIGURED',
      0,
    );
  }

  // Generation takes 30-60 s on a real model; give up well after that instead of hanging forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    const headers = usesModel ? { ...(init?.headers as Record<string, string> | undefined), ...curriculumLlmHeaders() } : init?.headers;
    res = await fetch(`${BASE}${path}`, { ...init, headers: await authHeaders(headers), signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AgentError('The Curriculum Designer took too long to respond.', 'TIMEOUT', 0, err);
    }
    throw new AgentError(
      `Could not reach the Curriculum Designer at ${BASE}. Is it running?`,
      'UNREACHABLE',
      0,
      err,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw await toAgentError(res);
  return (await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/**
 * The chosen course, as the query parameter every lab endpoint takes. The agent
 * answers 403 for a course the signed-in instructor does not own, so this is
 * what keeps one teacher out of another's labs.
 */
const inCourse = (path: string): string =>
  `${path}${path.includes('?') ? '&' : '?'}course_id=${encodeURIComponent(courseId())}`;

// ── Who am I, and what do I teach ────────────────────────────────────────────

/** The signed-in instructor and their courses. Creates the user on first sign-in. */
export function getMe(): Promise<Me> {
  return request<Me>('/me');
}

export function createCourse(name: string): Promise<Course> {
  return request<Course>('/courses', json({ name }));
}

export function listCourseLabs(course: string): Promise<{ course_id: string; labs: LabSummary[] }> {
  return request(`/courses/${encodeURIComponent(course)}/labs`);
}

// ── Lab material ─────────────────────────────────────────────────────────────

export function getLab(labId: string = currentLabId()): Promise<LabMaterial> {
  return request<LabMaterial>(inCourse(`/curriculum/${labId}`));
}

export function generateLab(
  params: GenerateParams,
  labId: string = currentLabId(),
): Promise<LabMaterial> {
  return request<LabMaterial>(
    '/curriculum/generate',
    json({
      lab_id: labId,
      course_id: courseId(),
      instructor_id: instructorEmail(),
      ...params,
    }),
    true,
  );
}

/** Start a lab step by step: the agent writes only the spec, then waits for approval. */
export function generateSpec(
  params: GenerateParams,
  labId: string = currentLabId(),
): Promise<LabMaterial> {
  return request<LabMaterial>(
    '/curriculum/generate-spec',
    json({
      lab_id: labId,
      course_id: courseId(),
      instructor_id: instructorEmail(),
      ...params,
    }),
    true,
  );
}

/**
 * Generate or regenerate one step. With `feedback` the agent addresses it. The quiz needs an
 * approved spec and the rubric an approved quiz; changing a step sends the later steps back to pending.
 */
export function generateStep(
  step: Step,
  feedback?: string,
  labId: string = currentLabId(),
): Promise<LabMaterial> {
  return request<LabMaterial>(
    inCourse(`/curriculum/${labId}/steps/${step}/generate`),
    json({ requested_by: instructorEmail(), ...(feedback ? { feedback } : {}) }),
    true,
  );
}

export function approveStep(
  step: Step,
  notes = '',
  labId: string = currentLabId(),
): Promise<LabMaterial> {
  return request<LabMaterial>(
    inCourse(`/curriculum/${labId}/steps/${step}/approve`),
    json({ approved_by: instructorEmail(), notes }),
  );
}

/**
 * A step's approval status. Labs saved before step-by-step approval have no per-step fields:
 * for those, an approved lab has all three steps approved and anything else is pending.
 */
export function stepStatus(lab: LabMaterial, step: Step): ApprovalStatus {
  return lab[`${step}_status`] ?? (lab.approval_status === 'approved' ? 'approved' : 'pending');
}

export function approveLab(notes = '', labId: string = currentLabId()): Promise<LabMaterial> {
  return request<LabMaterial>(
    inCourse(`/curriculum/${labId}/approve`),
    json({ approved_by: instructorEmail(), notes }),
  );
}

/** Records the feedback and regenerates quiz + rubric. The spec is preserved. */
export function requestChanges(
  feedback: string,
  labId: string = currentLabId(),
): Promise<LabMaterial> {
  return request<LabMaterial>(
    inCourse(`/curriculum/${labId}/request-changes`),
    json({ feedback, requested_by: instructorEmail() }),
    true,
  );
}

// ── Files ────────────────────────────────────────────────────────────────────

export function listFiles(labId: string = currentLabId()): Promise<LabFileList> {
  return request<LabFileList>(inCourse(`/curriculum/${labId}/files`));
}

export interface UploadAck {
  lab_id: string;
  field: string;
  chars_stored: number;
  message: string;
}

export function uploadMaterial(
  files: File[],
  labId: string = currentLabId(),
): Promise<UploadAck> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  return request<UploadAck>(inCourse(`/curriculum/${labId}/upload-material`), {
    method: 'POST',
    body: form, // no Content-Type: the browser sets the multipart boundary
  });
}

export function uploadInstructions(
  instructions: string,
  labId: string = currentLabId(),
): Promise<UploadAck> {
  return request<UploadAck>(
    inCourse(`/curriculum/${labId}/upload-instructions`),
    json({ instructions }),
  );
}

export interface DeleteFileAck {
  file_id: string;
  deleted: boolean;
  message: string;
}

export function deleteFile(
  fileId: string,
  labId: string = currentLabId(),
): Promise<DeleteFileAck> {
  return request<DeleteFileAck>(inCourse(`/curriculum/${labId}/files/${fileId}`), {
    method: 'DELETE',
  });
}

// ── Proofreading ─────────────────────────────────────────────────────────────

export interface TypoIssue {
  location: string;
  type: 'typo' | 'inconsistency' | 'ambiguity' | 'factual';
  suggestion: string;
}

/** Proofreads the spec, quiz and rubric. Does not change the lab. */
export function checkTypos(
  labId: string = currentLabId(),
): Promise<{ issues_found: number; issues: TypoIssue[] }> {
  return request(inCourse(`/curriculum/${labId}/check-typos`), { method: 'POST' }, true);
}

// ── Exports ──────────────────────────────────────────────────────────────────

/**
 * Download one of the PDFs the agent renders.
 *
 * It cannot be a plain `<a href>` any more: the export needs the ID token, and
 * a link sends no headers. So fetch it with the token and hand the browser the
 * bytes as a file instead.
 */
export async function downloadExport(
  kind: 'lab' | 'quiz' | 'rubric',
  labId: string = currentLabId(),
): Promise<void> {
  if (!BASE) {
    throw new AgentError(
      'VITE_CURRICULUM_URL is not set — the UI does not know where the Curriculum Designer is running.',
      'NOT_CONFIGURED',
      0,
    );
  }
  const path = inCourse(`/curriculum/${labId}/export/${kind}.pdf`);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: await authHeaders() });
  } catch (err) {
    throw new AgentError(
      `Could not reach the Curriculum Designer at ${BASE}. Is it running?`,
      'UNREACHABLE',
      0,
      err,
    );
  }
  if (!res.ok) throw await toAgentError(res);

  const url = URL.createObjectURL(await res.blob());
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${labId}-${kind}.pdf`;
    link.click();
  } finally {
    // Give the click a tick to start the save before the blob goes away.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
