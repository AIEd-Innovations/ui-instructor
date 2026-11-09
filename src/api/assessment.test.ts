import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAssessmentAgentConfig, getResults, regradeResult, saveAssessmentAgentConfig } from './assessment';
import type { AssessmentResult } from './assessment';

function record(studentId: string, score: number): AssessmentResult {
  return {
    submission_id: `${studentId}-1`,
    student_id: studentId,
    assignment_id: 'hw1_sorting',
    files: ['sort.py'],
    regrade_of: null,
    regrade_instructions: '',
    model: 'claude-sonnet-5-5',
    mock: false,
    criteria: [],
    score,
    max_score: 100,
    feedback: null,
    status: 'ai_graded',
    review_reasons: [],
    final_score: null,
    created_at: '2026-10-05T10:00:00',
  };
}

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function lastCall(): [string, RequestInit] {
  return vi.mocked(fetch).mock.calls.at(-1) as [string, RequestInit];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getResults', () => {
  it("asks the agent for each student's current grade", async () => {
    stubFetch(async () => Response.json([record('alex_morgan', 90), record('bella_kim', 39)]));

    const results = await getResults();

    expect(lastCall()[0]).toContain('/results?assignment_id=hw1_sorting&latest=true');
    expect(results.map(r => r.score)).toEqual([90, 39]);
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

describe('regradeResult', () => {
  it('posts the notes and sends the API key as a header', async () => {
    const regraded = { ...record('alex_morgan', 95), submission_id: 'new1', regrade_of: 'alex_morgan-1' };
    stubFetch(async () => Response.json(regraded));

    const result = await regradeResult('alex_morgan-1', 'Recursion is fine.', ' sk-test ');

    const [url, init] = lastCall();
    expect(url).toContain('/results/alex_morgan-1/regrade');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ instructions: 'Recursion is fine.' }));
    expect((init.headers as Record<string, string>)['X-LLM-API-Key']).toBe('sk-test');
    expect(result).toEqual(regraded);
  });

  it('sends no key header when no key was entered', async () => {
    stubFetch(async () => Response.json(record('alex_morgan', 80)));
    await regradeResult('alex_morgan-1', '', '  ');
    expect(lastCall()[1].headers).not.toHaveProperty('X-LLM-API-Key');
  });

  it("shows the agent's reason when it refuses", async () => {
    stubFetch(async () => Response.json(
      { detail: 'The submitted files were not stored for this result; resubmit to grade it again' },
      { status: 409 },
    ));
    await expect(regradeResult('old', '', '')).rejects.toThrow(
      'The assessment agent returned an error (409): The submitted files were not stored',
    );
  });
});

describe('assessment agent configuration', () => {
  const agentConfig = {
    tone: 'Encouraging' as const,
    feedback_detail: 'Detailed' as const,
    partial_credit: 'Strict' as const,
    notes: '',
  };

  it('loads the assignment configuration', async () => {
    stubFetch(async () => Response.json(agentConfig));
    await expect(getAssessmentAgentConfig()).resolves.toEqual(agentConfig);
  });

  it('saves the assignment configuration as JSON', async () => {
    stubFetch(async () => Response.json(agentConfig));
    await saveAssessmentAgentConfig(agentConfig);
    const [url, init] = lastCall();
    expect(url).toContain('/assignments/hw1_sorting/agent-config');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify(agentConfig));
  });
});
