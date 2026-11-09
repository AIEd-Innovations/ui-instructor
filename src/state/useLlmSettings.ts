import { useSyncExternalStore } from 'react';
import { getLlmSettings, subscribeLlmSettings } from '../api/llmKey';

export function useLlmSettings() {
  return useSyncExternalStore(subscribeLlmSettings, getLlmSettings);
}
