import { afterEach, describe, expect, it, vi } from 'vitest';
import { getResults } from './assessment';
import type { AssessmentResult } from './assessment';

function record(studentId: string, createdAt: string, score: number): AssessmentResult {
  return {
    submission_id: `${studentId}-${createdAt}`,
    student_id: studentId,
    assignment_id: 'hw1_sorting',
    automated_score: score,
    final_score: null,
    created_at: createdAt,
    code_grade: null,
    report_evaluation: null,
    anomaly_report: null,
    feedback: null,
    manual_review: null,
  };
}

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getResults', () => {
  it('keeps only the newest result per student', async () => {
    stubFetch(async () => Response.json([
      record('alex_morgan', '2026-10-05T09:00:00', 50),
      record('bella_kim', '2026-10-05T09:30:00', 39),
      record('alex_morgan', '2026-10-05T11:00:00', 90),
      record('alex_morgan', '2026-10-05T10:00:00', 70),
    ]));

    const results = await getResults();

    expect(results).toHaveLength(2);
    expect(results.find(r => r.student_id === 'alex_morgan')?.automated_score).toBe(90);
    expect(results.find(r => r.student_id === 'bella_kim')?.automated_score).toBe(39);
  });

  it('returns an empty list when nothing has been graded', async () => {
    stubFetch(async () => Response.json([]));
    expect(await getResults()).toEqual([]);
  });

  it('turns an HTTP error into a readable message', async () => {
    stubFetch(async () => new Response('boom', { status: 500 }));
    await expect(getResults()).rejects.toThrow('The assessment agent returned an error (500).');
  });

  it('says so when the agent cannot be reached', async () => {
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    await expect(getResults()).rejects.toThrow('Could not reach the assessment agent. Is it running?');
  });
});
