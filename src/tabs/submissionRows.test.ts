import { describe, expect, it } from 'vitest';
import type { AssessmentResult } from '../api/assessment';
import { SAMPLE_ROWS, compareRows, deriveStatus, rowFromResult } from './submissionRows';
import type { SubmissionRow } from './submissionRows';

function result(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    submission_id: 'abc12345',
    student_id: 'alex_morgan',
    assignment_id: 'hw1_sorting',
    automated_score: 84.75,
    final_score: null,
    created_at: '2026-10-05T10:00:00',
    code_grade: null,
    report_evaluation: null,
    anomaly_report: { flags: [], overall_risk: 'low', recommendation: '' },
    feedback: null,
    manual_review: { priority: 'normal', status: 'pending' },
    ...overrides,
  };
}

describe('deriveStatus', () => {
  it('is Graded for a low-risk, normal-priority result', () => {
    expect(deriveStatus(result())).toBe('Graded');
  });

  it('flags high and medium anomaly risk', () => {
    expect(deriveStatus(result({ anomaly_report: { flags: [], overall_risk: 'high', recommendation: '' } }))).toBe('Flagged ⚠');
    expect(deriveStatus(result({ anomaly_report: { flags: [], overall_risk: 'medium', recommendation: '' } }))).toBe('Flagged ⚠');
  });

  it('flags an urgent review priority even when anomaly risk is low', () => {
    expect(deriveStatus(result({ manual_review: { priority: 'urgent', status: 'pending' } }))).toBe('Flagged ⚠');
  });

  it('needs review for a high review priority', () => {
    expect(deriveStatus(result({ manual_review: { priority: 'high', status: 'pending' } }))).toBe('Needs Review');
  });

  it('is Graded once an instructor has set a final score, even if it was flagged', () => {
    const reviewed = result({
      final_score: 70,
      anomaly_report: { flags: [], overall_risk: 'high', recommendation: '' },
    });
    expect(deriveStatus(reviewed)).toBe('Graded');
  });

  it('copes with missing anomaly and review data', () => {
    expect(deriveStatus(result({ anomaly_report: null, manual_review: null }))).toBe('Graded');
  });
});

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
    expect(rowFromResult(result({ automated_score: 84.75 })).score).toBe(84.8);
    expect(rowFromResult(result({ automated_score: 84.75, final_score: 91 })).score).toBe(91);
  });

  it('turns test and report results into grading lines', () => {
    const row = rowFromResult(result({
      code_grade: {
        test_results: [
          { name: 'sorts empty list', passed: true, points_earned: 10, points_possible: 10 },
          { name: 'sorts duplicates', passed: false, points_earned: 0, points_possible: 10 },
        ],
      },
      report_evaluation: { criteria: [{ name: 'Clarity', score: 8, max_score: 10 }] },
    }));
    expect(row.grading).toEqual([
      '✓ sorts empty list: 10/10',
      '✗ sorts duplicates: 0/10',
      'Report · Clarity: 8/10',
    ]);
  });

  it('describes integrity flags and carries feedback through', () => {
    const row = rowFromResult(result({
      anomaly_report: {
        flags: [{ flag_type: 'plagiarism', confidence: 0.87, evidence: 'Matches another submission.', severity: 'high' }],
        overall_risk: 'high',
        recommendation: '',
      },
      feedback: { summary: 'Solid.', strengths: ['Clean code'], improvements: ['Add tests'] },
    }));
    expect(row.flags).toEqual(['plagiarism (high, 87% confidence): Matches another submission.']);
    expect(row.feedback).toBe('Solid.');
    expect(row.strengths).toEqual(['Clean code']);
    expect(row.improvements).toEqual(['Add tests']);
  });

  it('never invents submission text', () => {
    expect(rowFromResult(result()).submissionText).toBeNull();
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

  it('sorts by score ascending', () => {
    const scores = [...SAMPLE_ROWS].sort((a, b) => compareRows(a, b, 'score')).map(r => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('puts flagged first, then needs review, then graded', () => {
    const statuses = [...SAMPLE_ROWS].sort((a, b) => compareRows(a, b, 'status')).map(r => r.status);
    const firstGraded = statuses.indexOf('Graded');
    const lastFlagged = statuses.lastIndexOf('Flagged ⚠');
    const firstReview = statuses.indexOf('Needs Review');
    expect(lastFlagged).toBeLessThan(firstReview);
    expect(firstReview).toBeLessThan(firstGraded);
  });
});
