// Small pieces shared by the Lab Tasks and Lab Quiz tabs.

import { useState } from 'react';
import { checkTypos } from '../api/curriculum';
import type { ApprovalStatus, TypoIssue } from '../api/curriculum';
import { useLab } from '../state/labStore';

const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  needs_changes: 'Changes requested',
};

const APPROVAL_CLASS: Record<ApprovalStatus, string> = {
  pending: 'badge-review',
  approved: 'badge-graded',
  needs_changes: 'badge-flagged',
};

export function ApprovalPill({ status }: { status: ApprovalStatus }) {
  return (
    <span className={`badge ${APPROVAL_CLASS[status]}`}>{APPROVAL_LABEL[status]}</span>
  );
}

export function Notice({ kind, children }: { kind: 'error' | 'info'; children: React.ReactNode }) {
  return <div className={`notice notice-${kind}`}>{children}</div>;
}

export function LoadingState({ what }: { what: string }) {
  return <div className="content-card empty-state">Loading {what}…</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="content-card empty-state">
      <Notice kind="error">{message}</Notice>
      <button className="btn-outline" onClick={onRetry}>Try again</button>
    </div>
  );
}

/** Proofreads the whole lab (spec, quiz, rubric) and lists what it finds. */
export function TypoCheck() {
  const { busy } = useLab();
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState<TypoIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setChecking(true);
    setError(null);
    try {
      setIssues((await checkTypos()).issues);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="typo-check">
      <button className="btn-outline" onClick={() => void run()} disabled={busy || checking}>
        {checking ? 'Checking…' : 'Check typos'}
      </button>
      {error && <Notice kind="error">{error}</Notice>}
      {issues !== null && issues.length === 0 && <Notice kind="info">No issues found.</Notice>}
      {issues !== null && issues.length > 0 && (
        <ul className="objective-list">
          {issues.map(issue => (
            <li key={`${issue.location}-${issue.suggestion}`}>
              <strong>{issue.type}</strong> · {issue.location}: {issue.suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface RefineBarProps {
  placeholder: string;
  hint?: string;
  disabled?: boolean;
  onSend: (text: string) => Promise<void>;
}

/** The "ask the agent to refine this" input. Clears only on success. */
export function RefineBar({ placeholder, hint, disabled, onSend }: RefineBarProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const feedback = text.trim();
    if (!feedback || sending) return;

    setSending(true);
    setError(null);
    try {
      await onSend(feedback);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="prompt-input-bar">
        <input
          type="text"
          placeholder={placeholder}
          value={text}
          disabled={disabled || sending}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void send(); }}
        />
        <button
          className="btn-send"
          onClick={() => void send()}
          disabled={disabled || sending || text.trim() === ''}
        >
          {sending ? 'Working…' : 'Send'}
        </button>
      </div>
      {hint && <p className="prompt-hint">{hint}</p>}
    </>
  );
}
