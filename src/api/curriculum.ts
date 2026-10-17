// Direct client for the Curriculum Designer agent (no orchestrator — see #8).
//
// Set VITE_CURRICULUM_URL in .env (copy from .env.example). The agent runs on
// port 8003 locally. Types mirror models/curriculum.py and models/files.py in
// the curriculum-designer repo.

const BASE: string = import.meta.env.VITE_CURRICULUM_URL ?? '';
export const LAB_ID: string = import.meta.env.VITE_LAB_ID ?? 'lab4';
export const COURSE_ID: string = import.meta.env.VITE_COURSE_ID ?? 'csc580';
export const INSTRUCTOR_ID: string = import.meta.env.VITE_INSTRUCTOR_ID ?? 'instructor_1';

export const isConfigured = (): boolean => BASE !== '';

// ── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'short_answer' | 'multiple_choice' | 'code' | 'essay';
export type DifficultyTier = 'basic' | 'intermediate' | 'challenge';
export type ApprovalStatus = 'pending' | 'approved' | 'needs_changes';

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

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.status = status;
  }
}

async function toAgentError(res: Response): Promise<AgentError> {
  let code = `HTTP_${res.status}`;
  let message = res.statusText || 'Request failed';
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) {
    throw new AgentError(
      'VITE_CURRICULUM_URL is not set — the UI does not know where the Curriculum Designer is running.',
      'NOT_CONFIGURED',
      0,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new AgentError(
      `Could not reach the Curriculum Designer at ${BASE}. Is it running?`,
      'UNREACHABLE',
      0,
    );
  }

  if (!res.ok) throw await toAgentError(res);
  return (await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ── Lab material ─────────────────────────────────────────────────────────────

export function getLab(labId: string = LAB_ID): Promise<LabMaterial> {
  return request<LabMaterial>(`/curriculum/${labId}`);
}

export function generateLab(
  params: GenerateParams,
  labId: string = LAB_ID,
): Promise<LabMaterial> {
  return request<LabMaterial>(
    '/curriculum/generate',
    json({
      lab_id: labId,
      course_id: COURSE_ID,
      instructor_id: INSTRUCTOR_ID,
      ...params,
    }),
  );
}

export function approveLab(notes = '', labId: string = LAB_ID): Promise<LabMaterial> {
  return request<LabMaterial>(
    `/curriculum/${labId}/approve`,
    json({ approved_by: INSTRUCTOR_ID, notes }),
  );
}

/** Records the feedback and regenerates quiz + rubric. The spec is preserved. */
export function requestChanges(
  feedback: string,
  labId: string = LAB_ID,
): Promise<LabMaterial> {
  return request<LabMaterial>(
    `/curriculum/${labId}/request-changes`,
    json({ feedback, requested_by: INSTRUCTOR_ID }),
  );
}

// ── Files ────────────────────────────────────────────────────────────────────

export function listFiles(labId: string = LAB_ID): Promise<LabFileList> {
  return request<LabFileList>(`/curriculum/${labId}/files`);
}

export interface UploadAck {
  lab_id: string;
  field: string;
  chars_stored: number;
  message: string;
}

export function uploadMaterial(
  files: File[],
  labId: string = LAB_ID,
): Promise<UploadAck> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  return request<UploadAck>(`/curriculum/${labId}/upload-material`, {
    method: 'POST',
    body: form, // no Content-Type: the browser sets the multipart boundary
  });
}

export function uploadInstructions(
  instructions: string,
  labId: string = LAB_ID,
): Promise<UploadAck> {
  return request<UploadAck>(
    `/curriculum/${labId}/upload-instructions`,
    json({ instructions }),
  );
}

export interface DeleteFileAck {
  file_id: string;
  deleted: boolean;
  message: string;
}

export function deleteFile(fileId: string, labId: string = LAB_ID): Promise<DeleteFileAck> {
  return request<DeleteFileAck>(`/curriculum/${labId}/files/${fileId}`, {
    method: 'DELETE',
  });
}

// ── Exports ──────────────────────────────────────────────────────────────────

/** Direct download link — the agent streams a PDF with Content-Disposition. */
export function exportUrl(kind: 'lab' | 'quiz' | 'rubric', labId: string = LAB_ID): string {
  return `${BASE}/curriculum/${labId}/export/${kind}.pdf`;
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
