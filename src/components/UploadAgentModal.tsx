import { useRef, useState } from 'react';
import Modal from './Modal';
import { useLab } from '../state/labStore';

interface Props {
  onClose: () => void;
}

type Mode = 'write' | 'file';

// POST /curriculum/{lab}/upload-instructions takes plain text, so a dropped file
// is read in the browser and its contents become the instructions. That limits
// this to text formats — a PDF would need a parser the UI does not have.
const ACCEPT = '.txt,.md';
const MAX_BYTES = 5 * 1024 * 1024;

export default function UploadAgentModal({ onClose }: Props) {
  const { lab, uploadInstructions } = useLab();
  const [mode, setMode] = useState<Mode>('write');
  const [instructions, setInstructions] = useState(lab?.agent_instructions ?? '');
  const [filename, setFilename] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function readFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (!/\.(txt|md)$/i.test(file.name)) {
      setError(`${file.name} is not a .txt or .md file.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is over 5 MB.`);
      return;
    }

    setError(null);
    setFilename(file.name);
    setInstructions(await file.text());
  }

  const canSave = instructions.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await uploadInstructions(instructions.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Modal title="Upload Agent Instructions" onClose={saving ? () => {} : onClose} width={520}>
      <p className="modal-subtitle">
        Define how the AI agent should guide students during this lab. Stored with the
        lab and included in every generation prompt.
      </p>

      <div className="modal-tab-switch">
        <button
          className={`modal-tab${mode === 'write' ? ' modal-tab-active' : ''}`}
          onClick={() => setMode('write')}
          disabled={saving}
        >
          Write Instructions
        </button>
        <button
          className={`modal-tab${mode === 'file' ? ' modal-tab-active' : ''}`}
          onClick={() => setMode('file')}
          disabled={saving}
        >
          Upload File
        </button>
      </div>

      {mode === 'write' ? (
        <textarea
          className="modal-textarea"
          placeholder={'e.g. "Only give progressive hints. Never reveal the full solution. If a student asks for the answer directly, redirect them with a guiding question."'}
          value={instructions}
          disabled={saving}
          onChange={e => setInstructions(e.target.value)}
          rows={8}
        />
      ) : (
        <>
          <div
            className={`dropzone${dragging ? ' dropzone-active' : ''}${filename ? ' dropzone-filled' : ''}`}
            onClick={() => !saving && inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); void readFile(e.dataTransfer.files); }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              style={{ display: 'none' }}
              onChange={e => void readFile(e.target.files)}
            />
            {filename ? (
              <>
                <div className="dropzone-icon">📄</div>
                <div className="dropzone-filename">{filename}</div>
                <div className="dropzone-meta">
                  {instructions.length.toLocaleString()} characters loaded
                </div>
              </>
            ) : (
              <>
                <div className="dropzone-icon">⬆</div>
                <div className="dropzone-cta">Drag &amp; drop your instructions file</div>
                <div className="dropzone-meta">or click to browse</div>
                <div className="dropzone-hint">TXT or MD · max 5 MB</div>
              </>
            )}
          </div>
          {filename && (
            <button
              className="dropzone-clear"
              disabled={saving}
              onClick={e => { e.stopPropagation(); setFilename(null); setInstructions(''); }}
            >
              Remove file
            </button>
          )}
        </>
      )}

      {error && <div className="notice notice-error">{error}</div>}

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" disabled={!canSave} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save Instructions'}
        </button>
      </div>
    </Modal>
  );
}
