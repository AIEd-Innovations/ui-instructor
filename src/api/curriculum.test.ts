import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLlmKey } from './llmKey';

// The base URL is read when the module loads, so set it before importing.
beforeEach(() => {
  vi.stubEnv('VITE_CURRICULUM_URL', 'http://curriculum.test');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ issues_found: 0, issues: [], files: [] })));
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearLlmKey();
});

function lastHeaders(): Record<string, string> {
  const init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit;
  return (init.headers ?? {}) as Record<string, string>;
}

describe('Curriculum Designer requests', () => {
  it('sends the key and model on calls that use the model', async () => {
    const { checkTypos } = await import('./curriculum');
    const { setLlmSettings: set } = await import('./llmKey');
    set({ apiKey: 'sk-test', modelId: 'claude-haiku-5-5' });
    await checkTypos();
    expect(lastHeaders()).toMatchObject({ 'X-LLM-API-Key': 'sk-test', 'X-LLM-Model': 'claude-haiku-5-5' });
  });

  it('keeps the JSON content type when it adds the key', async () => {
    const { requestChanges } = await import('./curriculum');
    const { setLlmSettings: set } = await import('./llmKey');
    set({ apiKey: 'sk-test' });
    await requestChanges('Shorter, please.');
    expect(lastHeaders()['Content-Type']).toBe('application/json');
    expect(lastHeaders()['X-LLM-API-Key']).toBe('sk-test');
  });

  it('does not send the key on plain reads', async () => {
    const { listFiles } = await import('./curriculum');
    const { setLlmSettings: set } = await import('./llmKey');
    set({ apiKey: 'sk-test' });
    await listFiles();
    expect(lastHeaders()).not.toHaveProperty('X-LLM-API-Key');
  });

  it('sends no key headers when none is set', async () => {
    const { checkTypos } = await import('./curriculum');
    await checkTypos();
    expect(lastHeaders()).not.toHaveProperty('X-LLM-API-Key');
  });
});

describe('step-by-step generation', () => {
  function lastCall(): { url: string; body: Record<string, unknown> } {
    const [url, init] = vi.mocked(fetch).mock.calls.at(-1) as [string, RequestInit];
    return { url, body: JSON.parse(String(init.body)) };
  }

  it('starts with the spec only', async () => {
    const { generateSpec } = await import('./curriculum');
    await generateSpec({ title: 'T', learning_objectives: ['a'], difficulty: 'basic', estimated_duration_min: 60, material_weight: 'balanced' });
    expect(lastCall().url).toBe('http://curriculum.test/curriculum/generate-spec');
  });

  it('generates one step, with the feedback only when there is some', async () => {
    const { generateStep } = await import('./curriculum');
    await generateStep('quiz');
    expect(lastCall().url).toBe('http://curriculum.test/curriculum/lab4/steps/quiz/generate');
    expect(lastCall().body).not.toHaveProperty('feedback');
    await generateStep('spec', 'add recursion');
    expect(lastCall().body).toMatchObject({ feedback: 'add recursion' });
  });

  it('sends the key when a step calls the model, but not when it only approves', async () => {
    const { generateStep, approveStep } = await import('./curriculum');
    const { setLlmSettings: set } = await import('./llmKey');
    set({ apiKey: 'sk-test' });
    await generateStep('rubric');
    expect(lastHeaders()['X-LLM-API-Key']).toBe('sk-test');
    await approveStep('rubric');
    expect(lastHeaders()).not.toHaveProperty('X-LLM-API-Key');
  });

  it('reads the step status, falling back for labs saved before steps existed', async () => {
    const { stepStatus } = await import('./curriculum');
    type Lab = Parameters<typeof stepStatus>[0];
    expect(stepStatus({ approval_status: 'approved' } as Lab, 'quiz')).toBe('approved');
    expect(stepStatus({ approval_status: 'needs_changes' } as Lab, 'quiz')).toBe('pending');
    expect(stepStatus({ approval_status: 'pending', quiz_status: 'needs_changes' } as Lab, 'quiz')).toBe('needs_changes');
  });
});
