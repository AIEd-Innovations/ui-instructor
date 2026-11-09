// Direct client for the Assessment agent (no orchestrator).
// Endpoint reference: assessment_agent/api/routes.py. Result shapes mirror assessment_agent/models.py.
//
// Set VITE_ASSESSMENT_URL in .env.local (e.g. http://localhost:8000). When it is unset the UI
// does not call the agent and shows sample data instead.

const BASE = import.meta.env.VITE_ASSESSMENT_URL ?? '';
export const ASSIGNMENT_ID = import.meta.env.VITE_ASSIGNMENT_ID ?? 'hw1_sorting';
export const assessmentConfigured = BASE !== '';

const TIMEOUT_MS = 20_000;
// Grading is one model call per submission and can take up to a minute with a real model.
const GRADING_TIMEOUT_MS = 120_000;

/** The instructor's grading preferences for an assignment (assessment_agent/agent_config.py). */
export interface AssessmentAgentConfigPayload {
  tone: 'Encouraging' | 'Neutral' | 'Direct';
  feedback_detail: 'Brief' | 'Standard' | 'Detailed';
  partial_credit: 'Generous' | 'Balanced' | 'Strict';
  notes: string;
}

// ── Types (the subset of AssessmentResult the UI reads) ─────────────────────

export type ResultStatus = 'ai_graded' | 'needs_review' | 'instructor_graded';

export interface CriterionScore {
  id: string;
  name: string;
  score: number;
  max_points: number;
  justification: string;
  evidence: string;
}

export interface AssessmentResult {
  submission_id: string;
  student_id: string;
  assignment_id: string;
  files: string[];
  regrade_of: string | null;
  regrade_instructions: string;
  model: string;
  /** Graded by the offline mock model because no API key was sent: not a real grade. */
  mock: boolean;
  criteria: CriterionScore[];
  /** Sum of the criterion scores; null when grading failed. */
  score: number | null;
  max_score: number;
  feedback: { summary: string; strengths: string[]; improvements: string[]; next_steps: string[] } | null;
  status: ResultStatus;
  review_reasons: string[];
  /** Set by an instructor; replaces score. */
  final_score: number | null;
  created_at: string;
}

// ── Requests ────────────────────────────────────────────────────────────────

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) {
      // FastAPI puts the reason in "detail"; show it when there is one.
      const detail = await res.json().then(body => body?.detail, () => undefined);
      throw new Error(typeof detail === 'string'
        ? `The assessment agent returned an error (${res.status}): ${detail}`
        : `The assessment agent returned an error (${res.status}).`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('The assessment agent took too long to respond.', { cause: e });
    }
    if (e instanceof Error && e.message.startsWith('The assessment agent')) throw e;
    throw new Error('Could not reach the assessment agent. Is it running?', { cause: e });
  } finally {
    clearTimeout(timer);
  }
}

// ── Endpoints ───────────────────────────────────────────────────────────────

/** Each student's current grade for the configured assignment: the newest result, including regrades. */
export function getResults(): Promise<AssessmentResult[]> {
  return request(`/results?assignment_id=${encodeURIComponent(ASSIGNMENT_ID)}&latest=true`);
}

/**
 * Grade a submission again with the assignment's current rubric. The agent saves a new result
 * (with regrade_of set) and returns it; the original is left unchanged.
 *
 * apiKey is the teacher's key for the assignment's model vendor. It is sent with this request only.
 * Without one the agent grades with its offline mock model and marks the result as a mock grade.
 */
export function regradeResult(submissionId: string, instructions: string, apiKey: string): Promise<AssessmentResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey.trim()) headers['X-LLM-API-Key'] = apiKey.trim();
  return request(
    `/results/${encodeURIComponent(submissionId)}/regrade`,
    { method: 'POST', headers, body: JSON.stringify({ instructions }) },
    GRADING_TIMEOUT_MS,
  );
}

export function getAssessmentAgentConfig(): Promise<AssessmentAgentConfigPayload> {
  return request(`/assignments/${encodeURIComponent(ASSIGNMENT_ID)}/agent-config`);
}

export function saveAssessmentAgentConfig(config: AssessmentAgentConfigPayload): Promise<AssessmentAgentConfigPayload> {
  return request(`/assignments/${encodeURIComponent(ASSIGNMENT_ID)}/agent-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
