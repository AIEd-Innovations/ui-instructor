// The instructor's own LLM API key and model, used for every request that calls a model.
//
// The key lives in memory only: it is never written to localStorage, sessionStorage, cookies
// or the URL, so closing or reloading the tab forgets it. It is sent only in request headers,
// to the Curriculum Designer and the Assessment Agent, and never shown again once entered.
// Only the (non-secret) model choice is remembered for the session.

export type Vendor = 'anthropic' | 'openai' | 'gemini';

export interface LlmModel {
  id: string;
  vendor: Vendor;
  name: string;
}

// Mirrors SUPPORTED_MODELS in both agents (curriculum-designer services/llm_models.py and
// assessment_agent llm/models.py), which keep the same list. Keep the three in step.
export const LLM_MODELS: readonly LlmModel[] = [
  { id: 'claude-opus-5-5', vendor: 'anthropic', name: 'Claude Opus 5.5' },
  { id: 'claude-sonnet-5-5', vendor: 'anthropic', name: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', vendor: 'anthropic', name: 'Claude Haiku 5.5' },
  { id: 'gpt-6-astra', vendor: 'openai', name: 'GPT-6 Astra' },
  { id: 'gpt-6.1-sol', vendor: 'openai', name: 'GPT-6.1 Sol' },
  { id: 'gpt-6-luna', vendor: 'openai', name: 'GPT-6 Luna' },
  { id: 'gemini-4-argon', vendor: 'gemini', name: 'Gemini 4 Argon' },
  { id: 'gemini-3.8-flash', vendor: 'gemini', name: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.5-flash-lite', vendor: 'gemini', name: 'Gemini 3.5 Flash-Lite' },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet-5-5';

export interface LlmSettings {
  apiKey: string;
  modelId: string;
}

const MODEL_STORAGE_KEY = 'llm-model';

function readStoredModel(): string {
  try {
    const stored = sessionStorage.getItem(MODEL_STORAGE_KEY);
    if (stored && LLM_MODELS.some(m => m.id === stored)) return stored;
  } catch {
    /* storage unavailable: use the default */
  }
  return DEFAULT_MODEL_ID;
}

let settings: LlmSettings = { apiKey: '', modelId: readStoredModel() };
const listeners = new Set<() => void>();

export function getLlmSettings(): LlmSettings {
  return settings;
}

export function subscribeLlmSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setLlmSettings(next: Partial<LlmSettings>): void {
  settings = {
    apiKey: (next.apiKey ?? settings.apiKey).trim(),
    modelId: next.modelId ?? settings.modelId,
  };
  try {
    sessionStorage.setItem(MODEL_STORAGE_KEY, settings.modelId);
  } catch {
    /* the model choice just won't be remembered */
  }
  listeners.forEach(listener => listener());
}

export function clearLlmKey(): void {
  setLlmSettings({ apiKey: '' });
}

export const hasLlmKey = (): boolean => settings.apiKey !== '';

export function vendorOf(modelId: string): Vendor | undefined {
  return LLM_MODELS.find(m => m.id === modelId)?.vendor;
}

/** Headers for the Curriculum Designer: it needs the key and the model together. */
export function curriculumLlmHeaders(): Record<string, string> {
  if (!settings.apiKey) return {};
  return { 'X-LLM-API-Key': settings.apiKey, 'X-LLM-Model': settings.modelId };
}

/**
 * Headers for the Assessment Agent: only the key. It grades with the model set on the
 * assignment, so the key has to be for that model's vendor.
 */
export function assessmentLlmHeaders(): Record<string, string> {
  return settings.apiKey ? { 'X-LLM-API-Key': settings.apiKey } : {};
}
