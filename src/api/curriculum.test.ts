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
    expect(lastCall().url).toBe('http://curriculum.test/curriculum/generate-spec?course_id=csc580');
  });

  it('generates one step, with the feedback only when there is some', async () => {
    const { generateStep } = await import('./curriculum');
    await generateStep('quiz');
    expect(lastCall().url).toBe('http://curriculum.test/curriculum/lab4/steps/quiz/generate?course_id=csc580');
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

describe('courses', () => {
  function lastUrl(): string {
    return vi.mocked(fetch).mock.calls.at(-1)?.[0] as string;
  }

  it('names the current course on every lab request, and in the body of generate', async () => {
    const { listFiles, generateSpec } = await import('./curriculum');
    const { setCourse } = await import('../state/course');
    setCourse('course-a', 'CSC 580');
    await listFiles();
    expect(lastUrl()).toBe('http://curriculum.test/curriculum/lab4/files?course_id=course-a');
    await generateSpec({ title: 'T', learning_objectives: ['a'], difficulty: 'basic', estimated_duration_min: 60, material_weight: 'balanced' });
    const init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit;
    expect(JSON.parse(String(init.body)).course_id).toBe('course-a');
    setCourse('csc580');
  });

  it('asks who is signed in and creates courses', async () => {
    const { getMe, createCourse } = await import('./curriculum');
    await getMe();
    expect(lastUrl()).toBe('http://curriculum.test/me');
    await createCourse('CSC 580');
    expect(lastUrl()).toBe('http://curriculum.test/courses');
    const init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ name: 'CSC 580' });
  });

  it('downloads a PDF through a request that can carry the sign-in token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('%PDF', { status: 200 }));
    const click = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ click, remove: vi.fn() }), body: { appendChild: vi.fn() } });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    const { downloadExport } = await import('./curriculum');
    await downloadExport('rubric');
    expect(lastUrl()).toBe('http://curriculum.test/curriculum/lab4/export/rubric.pdf?course_id=csc580');
    expect(click).toHaveBeenCalled();
  });

  it('shows the agent\'s reason when a download is refused', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: { code: 'FORBIDDEN', message: 'You do not own this course' } }, { status: 403 }));
    const { downloadExport } = await import('./curriculum');
    await expect(downloadExport('lab')).rejects.toThrow('You do not own this course');
  });
});
