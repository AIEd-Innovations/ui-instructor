import { describe, expect, it } from 'vitest';
import type { AssessmentResult } from '../api/assessment';
import { SAMPLE_ROWS, compareRows, rowFromResult } from './submissionRows';
import type { SubmissionRow } from './submissionRows';

function result(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    submission_id: 'abc12345',
    student_id: 'alex_morgan',
    assignment_id: 'hw1_sorting',
    files: ['sort.py', 'report.md'],
    regrade_of: null,
    regrade_instructions: '',
    model: 'claude-sonnet-5-5',
    mock: false,
    criteria: [],
    score: 84.75,
    max_score: 100,
    feedback: null,
    status: 'ai_graded',
    review_reasons: [],
    final_score: null,
    created_at: '2026-10-05T10:00:00',
    ...overrides,
  };
}

describe('rowFromResult', () => {
  it('derives a display name and last name from the student id', () => {
    const row = rowFromResult(result({ student_id: 'alex_morgan' }));
    expect(row.name).toBe('Alex Morgan');
    expect(row.lastName).toBe('Morgan');
  });

  it('handles single-token ids', () => {
    const row = rowFromResult(result({ student_id: 'student42' }));
    expect(row.name).toBe('Student42');
    expect(row.lastName).toBe('Student42');
  });

  it('prefers the final score and rounds to one decimal', () => {
    expect(rowFromResult(result({ score: 84.75 })).score).toBe(84.8);
    expect(rowFromResult(result({ score: 84.75, final_score: 91 })).score).toBe(91);
    expect(rowFromResult(result()).maxScore).toBe(100);
  });

  it('has no score when grading failed', () => {
    expect(rowFromResult(result({ score: null, status: 'needs_review' })).score).toBeNull();
  });

  it("maps the agent's status", () => {
    expect(rowFromResult(result({ status: 'ai_graded' })).status).toBe('Graded');
    expect(rowFromResult(result({ status: 'needs_review' })).status).toBe('Needs Review');
    expect(rowFromResult(result({ status: 'instructor_graded' })).status).toBe('Reviewed');
  });

  it('turns criterion scores into grading lines', () => {
    const row = rowFromResult(result({
      criteria: [
        { id: 'c', name: 'Correctness', score: 35, max_points: 40, justification: 'Misses empty input.', evidence: '' },
        { id: 'q', name: 'Code Quality', score: 20, max_points: 20, justification: '', evidence: '' },
      ],
    }));
    expect(row.grading).toEqual(['Correctness: 35/40 — Misses empty input.', 'Code Quality: 20/20']);
  });

  it('carries review reasons, feedback, files and the mock flag through', () => {
    const row = rowFromResult(result({
      mock: true,
      review_reasons: ['No API key was provided.'],
      feedback: { summary: 'Solid.', strengths: ['Clean code'], improvements: ['Add tests'], next_steps: [] },
    }));
    expect(row.mock).toBe(true);
    expect(row.reasons).toEqual(['No API key was provided.']);
    expect(row.feedback).toBe('Solid.');
    expect(row.strengths).toEqual(['Clean code']);
    expect(row.improvements).toEqual(['Add tests']);
    expect(row.files).toEqual(['sort.py', 'report.md']);
  });

  it('keeps the submission id for regrading, and the regrade link and notes', () => {
    const row = rowFromResult(result({ submission_id: 'new1', regrade_of: 'abc12345', regrade_instructions: 'Be lenient.' }));
    expect(row.submissionId).toBe('new1');
    expect(row.regradeOf).toBe('abc12345');
    expect(row.regradeInstructions).toBe('Be lenient.');
  });

  it('never invents submission text', () => {
    expect(rowFromResult(result()).submissionText).toBeNull();
  });

  it('does not offer the legacy detail modal or regrading for sample rows the agent does not know', () => {
    expect(rowFromResult(result()).hasDetails).toBe(false);
    expect(SAMPLE_ROWS.every(r => r.hasDetails && r.submissionId === null)).toBe(true);
  });
});

describe('compareRows', () => {
  const byName = (rows: SubmissionRow[], key: Parameters<typeof compareRows>[2]) =>
    [...rows].sort((a, b) => compareRows(a, b, key)).map(r => r.name);

  it('sorts by last name, breaking ties by full name', () => {
    const rows = [
      { ...SAMPLE_ROWS[0], name: 'Zed Smith', lastName: 'Smith' },
      { ...SAMPLE_ROWS[1], name: 'Amy Smith', lastName: 'Smith' },
      { ...SAMPLE_ROWS[2], name: 'Bob Adams', lastName: 'Adams' },
    ];
    expect(byName(rows, 'lastName')).toEqual(['Bob Adams', 'Amy Smith', 'Zed Smith']);
  });

  it('sorts by score ascending, with ungraded first', () => {
    const rows = [{ ...SAMPLE_ROWS[0], score: null }, ...SAMPLE_ROWS.slice(1)];
    const scores = [...rows].sort((a, b) => compareRows(a, b, 'score')).map(r => r.score);
    expect(scores[0]).toBeNull();
    const graded = scores.slice(1) as number[];
    expect(graded).toEqual([...graded].sort((a, b) => a - b));
  });

  it('puts needs review first, then graded, then reviewed', () => {
    const statuses = [...SAMPLE_ROWS].sort((a, b) => compareRows(a, b, 'status')).map(r => r.status);
    expect(statuses.lastIndexOf('Needs Review')).toBeLessThan(statuses.indexOf('Graded'));
    expect(statuses.lastIndexOf('Graded')).toBeLessThan(statuses.indexOf('Reviewed'));
  });
});

describe('instructor review', () => {
  const result = {
    submission_id: 's1', student_id: 'alex_morgan', assignment_id: 'hw1', files: [], regrade_of: null,
    regrade_instructions: '', model: 'm', mock: false, criteria: [], score: 70, max_score: 100,
    feedback: null, status: 'instructor_graded', review_reasons: [], final_score: 85,
    instructor_notes: 'Report was strong.', created_at: '2026-11-14T00:00:00Z',
  } as const;

  it('shows the instructor grade and keeps the AI score', () => {
    const row = rowFromResult({ ...result } as never);
    expect(row.status).toBe('Reviewed');
    expect(row.score).toBe(85);
    expect(row.aiScore).toBe(70);
    expect(row.instructorNotes).toBe('Report was strong.');
  });

  it('copes with results saved before instructor notes existed', () => {
    const { instructor_notes: _unused, ...older } = result;
    void _unused;
    expect(rowFromResult(older as never).instructorNotes).toBe('');
  });
});
