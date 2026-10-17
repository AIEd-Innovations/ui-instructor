import { useRef, useState } from 'react';
import Modal from './Modal';
import { formatSize } from '../api/curriculum';
import { useLab } from '../state/labStore';

interface Props {
  onClose: () => void;
}

// The agent extracts text with pypdf and rejects anything else, so only PDFs are
// offered here. Image-only PDFs are rejected too — it returns PDF_NO_TEXT.
const ACCEPT = '.pdf';
const MAX_BYTES = 25 * 1024 * 1024;

export default function UploadMaterialModal({ onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { uploadMaterial } = useLab();

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(incoming)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) rejected.push(`${file.name} (not a PDF)`);
      else if (file.size > MAX_BYTES) rejected.push(`${file.name} (over 25 MB)`);
      else accepted.push(file);
    }

    setError(rejected.length ? `Skipped: ${rejected.join(', ')}` : null);
    setFiles(current => [...current, ...accepted]);
  }

  function removeFile(name: string) {
    setFiles(current => current.filter(file => file.name !== name));
  }

  async function upload() {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMaterial(files);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUploading(false);
    }
  }

  return (
    <Modal title="Upload Lab Material" onClose={uploading ? () => {} : onClose}>
      <p className="modal-subtitle">
        PDFs the agent should use as context when it writes the lab. The text is
        extracted and kept; re-generate afterwards to apply it.
      </p>

      <div
        className={`dropzone${dragging ? ' dropzone-active' : ''}${files.length ? ' dropzone-filled' : ''}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />
        {files.length > 0 ? (
          <>
            <div className="dropzone-icon">📄</div>
            <div className="dropzone-filename">
              {files.length} file{files.length > 1 ? 's' : ''} ready
            </div>
            <div className="dropzone-meta">Click to add more</div>
          </>
        ) : (
          <>
            <div className="dropzone-icon">⬆</div>
            <div className="dropzone-cta">Drag &amp; drop your PDFs here</div>
            <div className="dropzone-meta">or click to browse</div>
            <div className="dropzone-hint">PDF only · max 25 MB each</div>
          </>
        )}
      </div>

      {files.length > 0 && (
        <ul className="file-list">
          {files.map(file => (
            <li key={file.name}>
              <span className="file-list-name">{file.name}</span>
              <span className="file-list-meta">{formatSize(file.size)}</span>
              <button
                className="file-list-remove"
                onClick={() => removeFile(file.name)}
                disabled={uploading}
                aria-label={`Remove ${file.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <div className="notice notice-error">{error}</div>}

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose} disabled={uploading}>Cancel</button>
        <button
          className="btn-primary"
          disabled={files.length === 0 || uploading}
          onClick={() => void upload()}
        >
          {uploading ? 'Extracting text…' : 'Upload'}
        </button>
      </div>
    </Modal>
  );
}
