import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLlmKey } from './llmKey';

// The base URL is read when the module loads, so set it before importing.
beforeEach(async () => {
  vi.stubEnv('VITE_CURRICULUM_URL', 'http://curriculum.test');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ issues_found: 0, issues: [], files: [] })));
  vi.resetModules();
  // The course and lab used to come from VITE_COURSE_ID / VITE_LAB_ID; the
  // dashboard picks them now (see api/session.ts). Imported after
  // resetModules, so this is the same module instance the tests below load.
  const { setSelection } = await import('./session');
  setSelection({ courseId: 'csc580', labId: 'lab4' });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearLlmKey();
  (await import('./session')).clearSession();
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

describe('who am I, and what do I teach', () => {
  function lastUrl(): string {
    return String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
  }

  it('asks for the signed-in instructor and their courses', async () => {
    const { getMe } = await import('./curriculum');
    await getMe();
    expect(lastUrl()).toBe('http://curriculum.test/me');
  });

  it('creates a course with just a name', async () => {
    const { createCourse } = await import('./curriculum');
    await createCourse('CSC 580');
    const [url, init] = vi.mocked(fetch).mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe('http://curriculum.test/courses');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'CSC 580' });
  });

  it('lists one course’s labs', async () => {
    const { listCourseLabs } = await import('./curriculum');
    await listCourseLabs('course a/b');
    expect(lastUrl()).toBe('http://curriculum.test/courses/course%20a%2Fb/labs');
  });
});

describe('every lab request names its course', () => {
  function lastUrl(): string {
    return String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
  }

  it('sends course_id on reads, writes, files and exports', async () => {
    const api = await import('./curriculum');

    await api.getLab();
    expect(lastUrl()).toBe('http://curriculum.test/curriculum/lab4?course_id=csc580');

    await api.listFiles();
    expect(lastUrl()).toBe('http://curriculum.test/curriculum/lab4/files?course_id=csc580');

    await api.approveStep('spec');
    expect(lastUrl()).toContain('/steps/spec/approve?course_id=csc580');

    await api.checkTypos();
    expect(lastUrl()).toContain('/check-typos?course_id=csc580');

    await api.deleteFile('file-1');
    expect(lastUrl()).toBe('http://curriculum.test/curriculum/lab4/files/file-1?course_id=csc580');
  });

  it('puts the course in the body when the agent takes it there', async () => {
    const { generateSpec } = await import('./curriculum');
    const { setIdentity } = await import('./session');
    setIdentity({ email: 'alice@calpoly.edu', userId: 'u1' });

    await generateSpec({
      title: 'Sorting', learning_objectives: ['a'], difficulty: 'basic',
      estimated_duration_min: 60, material_weight: 'balanced',
    });
    const init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      course_id: 'csc580',
      lab_id: 'lab4',
      // The agent records the signed-in email itself; this is only context.
      instructor_id: 'alice@calpoly.edu',
    });
  });
});

describe('what 401 and 403 mean to the instructor', () => {
  it('turns a 401 into "your sign-in expired", and says so once', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const { getLab, SIGNED_OUT } = await import('./curriculum');
    const { onSignedOut } = await import('./session');

    let told = 0;
    onSignedOut(() => { told += 1; });
    try {
      await expect(getLab()).rejects.toMatchObject({
        code: SIGNED_OUT,
        message: 'Your sign-in expired. Sign in again to continue.',
      });
      expect(told).toBe(1);
    } finally {
      onSignedOut(null);
    }
  });

  it('turns a 403 into "another instructor’s course"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
    const { listFiles, NOT_YOUR_COURSE } = await import('./curriculum');
    await expect(listFiles()).rejects.toMatchObject({
      code: NOT_YOUR_COURSE,
      message: 'This course belongs to another instructor.',
      status: 403,
    });
  });

  it('refuses to download an export it cannot reach', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
    const { downloadExport } = await import('./curriculum');
    await expect(downloadExport('lab')).rejects.toMatchObject({ status: 403 });
  });
});
