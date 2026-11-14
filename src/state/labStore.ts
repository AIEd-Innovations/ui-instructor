// Context object and hook, kept apart from the provider component so the file
// exporting <LabProvider> exports nothing else (react-refresh rule).

import { createContext, useContext } from 'react';
import type { GenerateParams, LabFileSummary, LabMaterial, Step } from '../api/curriculum';

export interface LabState {
  lab: LabMaterial | null;
  files: LabFileSummary[];
  loading: boolean;
  /** Set when the lab could not be loaded at all. */
  error: string | null;
  /** True before the lab has ever been generated (agent returns LAB_NOT_FOUND). */
  notGenerated: boolean;
  /** A mutating call is in flight — disable the buttons that would race it. */
  busy: boolean;

  refresh: () => Promise<void>;
  /** Writes the spec only; the quiz and rubric follow, one approval at a time. */
  generate: (params: GenerateParams) => Promise<void>;
  /** Generate or regenerate one step; `feedback` is the instructor's change request. */
  generateStep: (step: Step, feedback?: string) => Promise<void>;
  approveStep: (step: Step, notes?: string) => Promise<void>;
  uploadMaterial: (files: File[]) => Promise<string>;
  uploadInstructions: (text: string) => Promise<string>;
  deleteFile: (fileId: string) => Promise<void>;
}

export const LabContext = createContext<LabState | null>(null);

export function useLab(): LabState {
  const context = useContext(LabContext);
  if (!context) throw new Error('useLab must be used inside <LabProvider>');
  return context;
}
