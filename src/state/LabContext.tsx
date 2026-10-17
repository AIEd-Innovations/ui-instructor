// One copy of the lab lives here, shared by the tabs, the left panel and the
// modals — they all mutate the same object on the agent, so they must not each
// hold their own stale version.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import * as api from '../api/curriculum';
import type { LabFileSummary, LabMaterial } from '../api/curriculum';
import { LabContext } from './labStore';
import type { LabState } from './labStore';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function LabProvider({ children }: { children: ReactNode }) {
  const [lab, setLab] = useState<LabMaterial | null>(null);
  const [files, setFiles] = useState<LabFileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notGenerated, setNotGenerated] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      setFiles((await api.listFiles()).files);
    } catch {
      // The lab may not exist yet; an empty list is the honest display.
      setFiles([]);
    }
  }, []);

  /** Fetch everything. Starts with an await, so nothing is set synchronously
   *  when this runs from an effect. */
  const load = useCallback(async () => {
    try {
      const material = await api.getLab();
      setLab(material);
      setNotGenerated(false);
      setError(null);
    } catch (err) {
      setLab(null);
      if (err instanceof api.AgentError && err.code === 'LAB_NOT_FOUND') {
        setNotGenerated(true);
        setError(null);
      } else {
        setError(messageOf(err));
      }
    }
    await loadFiles();
    setLoading(false);
  }, [loadFiles]);

  useEffect(() => {
    // Initial fetch on mount. The rule would rather this went through a
    // data-fetching library or an external store; the app has neither, and
    // `load` only sets state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  /** Every mutating call returns the updated lab — adopt it rather than refetch. */
  const run = useCallback(async (action: () => Promise<LabMaterial>) => {
    setBusy(true);
    try {
      setLab(await action());
      setNotGenerated(false);
      setError(null);
    } finally {
      setBusy(false);
    }
  }, []);

  /** The lab's material_content changes server-side when files do. */
  const resyncLab = useCallback(async () => {
    try {
      setLab(await api.getLab());
    } catch {
      /* not generated yet — the files are still stored against the lab id */
    }
  }, []);

  const value = useMemo<LabState>(
    () => ({
      lab,
      files,
      loading,
      error,
      notGenerated,
      busy,
      refresh,
      generate: params => run(() => api.generateLab(params)),
      approve: (notes = '') => run(() => api.approveLab(notes)),
      requestChanges: feedback => run(() => api.requestChanges(feedback)),

      uploadMaterial: async uploads => {
        setBusy(true);
        try {
          const ack = await api.uploadMaterial(uploads);
          await loadFiles();
          await resyncLab();
          return ack.message;
        } finally {
          setBusy(false);
        }
      },

      uploadInstructions: async text => {
        setBusy(true);
        try {
          const ack = await api.uploadInstructions(text);
          await resyncLab();
          return ack.message;
        } finally {
          setBusy(false);
        }
      },

      deleteFile: async fileId => {
        setBusy(true);
        try {
          await api.deleteFile(fileId);
          await loadFiles();
          await resyncLab();
        } finally {
          setBusy(false);
        }
      },
    }),
    [lab, files, loading, error, notGenerated, busy, refresh, run, loadFiles, resyncLab],
  );

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}
