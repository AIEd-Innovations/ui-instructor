// Context object and hook, kept apart from the provider component so the file
// exporting <LabProvider> exports nothing else (react-refresh rule).

import { createContext, useContext } from 'react';
import type { GenerateParams, LabFileSummary, LabMaterial } from '../api/curriculum';

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
  generate: (params: GenerateParams) => Promise<void>;
  approve: (notes?: string) => Promise<void>;
  requestChanges: (feedback: string) => Promise<void>;
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
