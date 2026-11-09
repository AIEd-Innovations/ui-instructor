import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assessmentLlmHeaders,
  clearLlmKey,
  curriculumLlmHeaders,
  getLlmSettings,
  hasLlmKey,
  setLlmSettings,
  vendorOf,
} from './llmKey';

// Tests run in Node, so give the module in-memory stand-ins for the browser storages.
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}
const session = fakeStorage();
const local = fakeStorage();

beforeEach(() => {
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', local);
});

afterEach(() => {
  clearLlmKey();
  session.data.clear();
  local.data.clear();
  vi.unstubAllGlobals();
});

describe('LLM key settings', () => {
  it('sends no headers until a key is set', () => {
    expect(curriculumLlmHeaders()).toEqual({});
    expect(assessmentLlmHeaders()).toEqual({});
    expect(hasLlmKey()).toBe(false);
  });

  it('sends the key and model to the Curriculum Designer, and only the key to the Assessment Agent', () => {
    setLlmSettings({ apiKey: '  sk-test  ', modelId: 'gpt-6-luna' });
    expect(curriculumLlmHeaders()).toEqual({ 'X-LLM-API-Key': 'sk-test', 'X-LLM-Model': 'gpt-6-luna' });
    expect(assessmentLlmHeaders()).toEqual({ 'X-LLM-API-Key': 'sk-test' });
  });

  it('forgets the key when cleared but keeps the model', () => {
    setLlmSettings({ apiKey: 'sk-test', modelId: 'gemini-3.8-flash' });
    clearLlmKey();
    expect(hasLlmKey()).toBe(false);
    expect(getLlmSettings().modelId).toBe('gemini-3.8-flash');
  });

  it('never writes the key to browser storage', () => {
    setLlmSettings({ apiKey: 'sk-secret', modelId: 'claude-haiku-5-5' });
    const stored = JSON.stringify([...session.data, ...local.data]);
    expect(stored).not.toContain('sk-secret');
    expect(session.data.get('llm-model')).toBe('claude-haiku-5-5');
  });

  it('knows the vendor of each model', () => {
    expect(vendorOf('claude-opus-5-5')).toBe('anthropic');
    expect(vendorOf('gpt-6-astra')).toBe('openai');
    expect(vendorOf('nope')).toBeUndefined();
  });
});
