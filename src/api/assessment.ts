// Direct client for the Assessment agent (no orchestrator).
// Endpoint reference: assessment_agent/api/routes.py. Result shapes mirror assessment_agent/models.py.
//
// Set VITE_ASSESSMENT_URL in .env.local (e.g. http://localhost:8000). When it is unset the UI
// does not call the agent and shows sample data instead.

const BASE = import.meta.env.VITE_ASSESSMENT_URL ?? '';
export const ASSIGNMENT_ID = import.meta.env.VITE_ASSIGNMENT_ID ?? 'hw1_sorting';
export const assessmentConfigured = BASE !== '';

const TIMEOUT_MS = 20_000;

export interface AssessmentAgentConfigPayload {
  tone: 'Encouraging' | 'Neutral' | 'Direct' | 'Analytical';
  strictness: 'Flexible' | 'Balanced' | 'High';
  support_style: 'Socratic questions' | 'Progressive hints' | 'Concise feedback' | 'Detailed explanations';
  feedback_focus: 'Build understanding' | 'Build confidence' | 'Improve accuracy' | 'Encourage reflection';
  guardrail: 'Never give a full answer' | 'Ask for an attempt first' | 'Escalate uncertainty to the instructor' | 'Only use approved course materials';
  instructions: string;
}

// ── Types (the subset of AssessmentResult the UI reads) ─────────────────────

export interface TestCaseResult {
  name: string;
  passed: boolean;
  points_earned: number;
  points_possible: number;
}

export interface ReportCriterion {
  name: string;
  score: number;
  max_score: number;
}

export interface AnomalyFlag {
  flag_type: string;
  confidence: number;
  evidence: string;
  severity: string;
}

export interface AssessmentResult {
  submission_id: string;
  student_id: string;
  assignment_id: string;
  automated_score: number;
  final_score: number | null;
  created_at: string;
  code_grade: { test_results: TestCaseResult[] } | null;
  report_evaluation: { criteria: ReportCriterion[] } | null;
  anomaly_report: { flags: AnomalyFlag[]; overall_risk: string; recommendation: string } | null;
  feedback: { summary: string; strengths: string[]; improvements: string[] } | null;
  manual_review: { priority: string; status: string } | null;
}

// ── Endpoints ───────────────────────────────────────────────────────────────

/**
 * All graded results for the configured assignment, newest per student only.
 * The agent appends a new record on every (re)submission, so older ones are dropped here.
 */
export async function getResults(): Promise<AssessmentResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/results?assignment_id=${encodeURIComponent(ASSIGNMENT_ID)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`The assessment agent returned an error (${res.status}).`);
    const all = (await res.json()) as AssessmentResult[];

    const latest = new Map<string, AssessmentResult>();
    for (const result of all) {
      const existing = latest.get(result.student_id);
      if (!existing || result.created_at > existing.created_at) latest.set(result.student_id, result);
    }
    return [...latest.values()];
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

async function agentConfigRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`The assessment agent returned an error (${res.status}).`);
    return await res.json() as T;
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

export function getAssessmentAgentConfig(): Promise<AssessmentAgentConfigPayload> {
  return agentConfigRequest(`/assignments/${encodeURIComponent(ASSIGNMENT_ID)}/agent-config`);
}

export function saveAssessmentAgentConfig(config: AssessmentAgentConfigPayload): Promise<AssessmentAgentConfigPayload> {
  return agentConfigRequest(`/assignments/${encodeURIComponent(ASSIGNMENT_ID)}/agent-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
