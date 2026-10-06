import type { AssessmentResult } from '../api/assessment';

export type SubmissionStatus = 'Graded' | 'Flagged ⚠' | 'Needs Review';

/** One table row, whether it came from the assessment agent or from the sample data below. */
export interface SubmissionRow {
  id: string;
  name: string;
  lastName: string;
  score: number;
  status: SubmissionStatus;
  feedback: string;
  /** The assessment agent does not store submission text yet, so live rows have null here. */
  submissionText: string | null;
  grading: string[];
  strengths: string[];
  improvements: string[];
  flags: string[];
}

// ── Sorting ─────────────────────────────────────────────────────────────────

export type SortKey = 'lastName' | 'score' | 'status';

// Lower rank sorts first in ascending order: items needing attention come first.
const STATUS_RANK: Record<SubmissionStatus, number> = { 'Flagged ⚠': 0, 'Needs Review': 1, 'Graded': 2 };

export function compareRows(a: SubmissionRow, b: SubmissionRow, key: SortKey): number {
  if (key === 'score') return a.score - b.score;
  if (key === 'status') return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  return a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name);
}

// ── Live data ───────────────────────────────────────────────────────────────

// The agent only knows a student_id (e.g. "alex_morgan"), so derive a display name from it.
function displayName(studentId: string): string {
  return studentId
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// The agent always reports status "completed", so derive the table status from review and anomaly data.
export function deriveStatus(r: AssessmentResult): SubmissionStatus {
  const risk = r.anomaly_report?.overall_risk;
  const priority = r.manual_review?.priority;
  if (r.final_score !== null) return 'Graded'; // an instructor has already reviewed it
  if (risk === 'high' || risk === 'medium' || priority === 'urgent') return 'Flagged ⚠';
  if (priority === 'high') return 'Needs Review';
  return 'Graded';
}

export function rowFromResult(r: AssessmentResult): SubmissionRow {
  const name = displayName(r.student_id);
  const grading = [
    ...(r.code_grade?.test_results ?? []).map(
      t => `${t.passed ? '✓' : '✗'} ${t.name}: ${t.points_earned}/${t.points_possible}`,
    ),
    ...(r.report_evaluation?.criteria ?? []).map(c => `Report · ${c.name}: ${c.score}/${c.max_score}`),
  ];
  return {
    id: r.submission_id,
    name,
    lastName: name.split(' ').slice(-1)[0],
    score: Math.round((r.final_score ?? r.automated_score) * 10) / 10,
    status: deriveStatus(r),
    feedback: r.feedback?.summary ?? '',
    submissionText: null,
    grading,
    strengths: r.feedback?.strengths ?? [],
    improvements: r.feedback?.improvements ?? [],
    flags: (r.anomaly_report?.flags ?? []).map(
      f => `${f.flag_type} (${f.severity}, ${Math.round(f.confidence * 100)}% confidence): ${f.evidence}`,
    ),
  };
}

// ── Sample data (shown when the assessment agent is not configured or unreachable) ──

function sample(
  firstName: string,
  lastName: string,
  score: number,
  status: SubmissionStatus,
  feedback: string,
  submissionText: string,
  grading: string[],
): SubmissionRow {
  return {
    id: `${firstName} ${lastName}`,
    name: `${firstName} ${lastName}`,
    lastName,
    score,
    status,
    feedback,
    submissionText,
    grading,
    strengths: [],
    improvements: [],
    flags: [],
  };
}

export const SAMPLE_ROWS: SubmissionRow[] = [
  sample('Alex', 'M', 92, 'Graded', 'Well-structured logic. Minor edge case missed on traversal.',
    'Implemented Node, insert_head, delete and traverse. Report discusses O(1) head insertion.',
    ['-5: traversal fails on an empty list', '-3: report omits the deletion case']),
  sample('Bella', 'K', 88, 'Graded', 'Good pointer management. Review head-node deletion.',
    'Full implementation with tests for insert and delete. Report is brief.',
    ['-8: deleting the head node leaves a dangling reference', '-4: report lacks analysis']),
  sample('Carlos', 'R', 45, 'Flagged ⚠', '87% similarity + excessive AI usage. Pending review.',
    'Code closely matches another submission, including identical variable names and comments.',
    ['-30: tasks 2 and 3 incomplete', '-25: flagged for similarity, pending instructor review']),
  sample('Dana', 'W', 85, 'Graded', 'Solid work. Deletion edge case handled correctly.',
    'Clean implementation with docstrings. Cycle detection included as a bonus.',
    ['-10: no tests for traversal', '-5: inconsistent naming']),
  sample('Ethan', 'L', 62, 'Graded', 'Task 1 complete. Task 2 incomplete — pointer logic missing.',
    'Task 1 complete. Task 2 stops after creating nodes; links are never set.',
    ['-30: task 2 pointer logic missing', '-8: no report']),
  sample('Fiona', 'S', 79, 'Graded', 'Memory management correct. Minor style issues.',
    'Correct implementation with explicit cleanup. Long functions, few comments.',
    ['-12: style and readability', '-9: report missing edge cases']),
  sample('Jake', 'N', 71, 'Needs Review', 'Partial completion. Needs manual review for task 3.',
    'Tasks 1 and 2 complete. Task 3 uses an approach the grader could not match to the solution.',
    ['-15: task 3 unverified, needs manual review', '-14: partial report']),
  sample('Nina', 'Q', 48, 'Flagged ⚠', '87% similarity with Carlos R. Pending review.',
    'Code closely matches Carlos R. Same structure and the same unusual comments.',
    ['-27: tasks 2 and 3 incomplete', '-25: flagged for similarity, pending instructor review']),
];
