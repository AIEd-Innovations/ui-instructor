import { useRef, useState } from 'react';
import Modal from './Modal';

interface Props {
  /** True when a lab already exists, so uploading will regenerate it. */
  willRegenerate: boolean;
  onUploaded: (file: File) => void;
  onClose: () => void;
}

export default function UploadMaterialModal({ willRegenerate, onUploaded, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The curriculum designer only accepts PDFs.
  function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    setError(null);
    setFile(picked);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function formatSize(bytes: number) {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Modal title="Upload Lab Material" onClose={onClose}>
      <p className="modal-subtitle">
        Attach the lab specification or supporting files for this session.
      </p>

      <div
        className={`dropzone${dragging ? ' dropzone-active' : ''}${file ? ' dropzone-filled' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        {file ? (
          <>
            <div className="dropzone-icon">📄</div>
            <div className="dropzone-filename">{file.name}</div>
            <div className="dropzone-meta">{formatSize(file.size)}</div>
          </>
        ) : (
          <>
            <div className="dropzone-icon">⬆</div>
            <div className="dropzone-cta">Drag &amp; drop your file here</div>
            <div className="dropzone-meta">or click to browse</div>
            <div className="dropzone-hint">PDF only</div>
          </>
        )}
      </div>

      {error && <div className="status-line status-error" role="alert">{error}</div>}
      {willRegenerate && (
        <p className="modal-subtitle">Uploading regenerates the lab with this material: it goes back to version 1 and pending approval, and any quiz refinements are lost.</p>
      )}

      {file && (
        <button
          className="dropzone-clear"
          onClick={e => { e.stopPropagation(); setFile(null); }}
        >
          Remove file
        </button>
      )}

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          disabled={!file}
          onClick={() => { if (file) onUploaded(file); onClose(); }}
        >
          Upload
        </button>
      </div>
    </Modal>
  );
}
