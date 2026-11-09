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
