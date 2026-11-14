import { Fragment, useEffect, useState } from 'react';
import './GradedSubmissions.css';
import { ASSIGNMENT_ID, assessmentConfigured, getResults, regradeResult, reviewResult, submitForGrading } from '../api/assessment';
import type { AssessmentResult } from '../api/assessment';
import { useLlmSettings } from '../state/useLlmSettings';
import { SAMPLE_ROWS, compareRows, rowFromResult } from './submissionRows';
import type { SortKey, SubmissionRow, SubmissionStatus } from './submissionRows';

function statusBadge(status: SubmissionStatus) {
  if (status === 'Graded') return <span className="badge badge-graded">Graded</span>;
  if (status === 'Reviewed') return <span className="badge badge-reviewed">Reviewed</span>;
  return <span className="badge badge-flagged">Needs Review</span>;
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="preview-label">{title}</div>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

interface RegradeFormProps {
  submissionId: string;
  onRegraded: (result: AssessmentResult) => void;
}

function RegradeForm({ submissionId, onRegraded }: RegradeFormProps) {
  const { apiKey } = useLlmSettings();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <button className="btn-outline" onClick={() => setOpen(true)}>Regrade</button>;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onRegraded(await regradeResult(submissionId, notes.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="regrade-form">
      <div className="preview-label">Regrade</div>
      <p className="regrade-help">
        Grades this submission again with the assignment's current rubric, solution and materials.
        The new grade replaces this one in the table; the current grade is kept as history.
      </p>
      <label>
        Notes for the grader (optional)
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. A recursive solution is acceptable; don't penalize it."
          rows={3}
          disabled={busy}
        />
      </label>
      <div className="regrade-help">
        {apiKey
          ? 'Regrading with your API key. It has to be for the assignment’s model vendor.'
          : 'No API key set, so the agent returns a mock grade marked as not real. Use “Add API key” at the top of the page.'}
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="regrade-actions">
        <button className="btn-outline" onClick={() => { setOpen(false); setError(null); }} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Regrading…' : 'Regrade'}
        </button>
      </div>
    </div>
  );
}

interface GradeFormProps {
  onGraded: (result: AssessmentResult) => void;
  onClose: () => void;
}

/** Grade a student's files now, with the instructor's API key. */
function GradeForm({ onGraded, onClose }: GradeFormProps) {
  const { apiKey } = useLlmSettings();
  const [studentId, setStudentId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = studentId.trim();
  const canSubmit = id !== '' && files.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      onGraded(await submitForGrading(id, files));
      setStudentId('');
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="regrade-form" style={{ marginBottom: 16 }}>
      <div className="preview-label">Grade a submission — {ASSIGNMENT_ID}</div>
      <p className="regrade-help">
        Grades one student's files against this assignment's rubric. Plain text only (code, reports, notes);
        PDFs and Word files are not accepted. Grading takes a few seconds to a minute.
      </p>
      <label>
        Student ID
        <input
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          placeholder="e.g. alex_morgan"
          disabled={busy}
        />
      </label>
      <label>
        Files
        <input
          type="file"
          multiple
          onChange={e => setFiles(Array.from(e.target.files ?? []))}
          disabled={busy}
        />
      </label>
      <div className="regrade-help">
        {apiKey
          ? 'Grading with your API key. It has to be for the assignment’s model vendor.'
          : 'No API key set, so the agent returns a mock grade marked as not real. Use “Add API key” at the top of the page.'}
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="regrade-actions">
        <button className="btn-outline" onClick={onClose} disabled={busy}>Close</button>
        <button className="btn-primary" onClick={() => void submit()} disabled={!canSubmit}>
          {busy ? 'Grading…' : 'Grade'}
        </button>
      </div>
    </div>
  );
}

interface ReviewFormProps {
  submissionId: string;
  maxScore: number;
  initialScore: number | null;
  initialNotes: string;
  onReviewed: (result: AssessmentResult) => void;
}

/** The instructor's own grade. It replaces the AI score and marks the submission Reviewed. */
function ReviewForm({ submissionId, maxScore, initialScore, initialNotes, onReviewed }: ReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(initialScore === null ? '' : String(initialScore));
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <button className="btn-outline" onClick={() => setOpen(true)}>Set my grade</button>;
  }

  const value = Number(score);
  const valid = score.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= maxScore;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      onReviewed(await reviewResult(submissionId, value, notes.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="regrade-form">
      <div className="preview-label">Your grade</div>
      <p className="regrade-help">
        Replaces the AI score in the table and marks this submission as reviewed. The AI score is kept on the record.
      </p>
      <label>
        Score (0 to {maxScore})
        <input
          type="number"
          min={0}
          max={maxScore}
          step="any"
          value={score}
          onChange={e => setScore(e.target.value)}
          disabled={busy}
        />
      </label>
      <label>
        Notes (optional)
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Full marks for the report; the traversal bug is the only deduction."
          rows={3}
          disabled={busy}
        />
      </label>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="regrade-actions">
        <button className="btn-outline" onClick={() => { setOpen(false); setError(null); }} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={() => void submit()} disabled={busy || !valid}>
          {busy ? 'Saving…' : 'Save grade'}
        </button>
      </div>
    </div>
  );
}

export default function GradedSubmissions({ onSelectStudent }: { onSelectStudent: (name: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('lastName');
  const [descending, setDescending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showGrade, setShowGrade] = useState(false);

  // null until the agent has answered; only used when the agent is configured.
  const [liveRows, setLiveRows] = useState<SubmissionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentConfigured) return;
    let cancelled = false; // ignore the answer if the tab was closed before it arrived
    getResults()
      .then(results => { if (!cancelled) setLiveRows(results.map(rowFromResult)); })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Request failed'); });
    return () => { cancelled = true; };
  }, []);

  const loading = assessmentConfigured && liveRows === null && loadError === null;
  const data = !assessmentConfigured ? SAMPLE_ROWS : (liveRows ?? []);
  const rows = [...data].sort((a, b) => (descending ? -1 : 1) * compareRows(a, b, sortKey));

  const graded = data.filter(r => r.status === 'Graded').length;
  const review = data.filter(r => r.status === 'Needs Review').length;
  const reviewed = data.filter(r => r.status === 'Reviewed').length;

  function toggle(id: string) {
    setExpanded(current => (current === id ? null : id));
  }

  // A regrade is a new result: it takes the old row's place and stays open.
  function replaceRow(oldId: string, result: AssessmentResult) {
    const row = rowFromResult(result);
    setLiveRows(current => (current ?? []).map(r => (r.id === oldId ? row : r)));
    setExpanded(row.id);
  }

  // A new grade replaces that student's earlier row: the table shows each student's current grade.
  function addGraded(result: AssessmentResult) {
    const row = rowFromResult(result);
    setLiveRows(current => [row, ...(current ?? []).filter(r => r.name !== row.name)]);
    setExpanded(row.id);
  }

  return (
    <div className="content-card">
      <div className="content-header">
        <div className="content-title">
          <h2>Student Submissions — Lab 4</h2>
          <p>
            {loadError
              ? 'Results unavailable'
              : `${data.length} submissions · ${graded} graded · ${review} needs review · ${reviewed} reviewed`}
          </p>
        </div>
        <div className="content-actions">
          <button className="btn-outline">Download All (CSV)</button>
          <button
            className="btn-primary"
            onClick={() => setShowGrade(s => !s)}
            disabled={!assessmentConfigured}
            title={assessmentConfigured ? undefined : 'The assessment agent is not configured'}
          >
            Grade Submissions
          </button>
        </div>
      </div>
      <hr className="content-divider" />

      {showGrade && assessmentConfigured && (
        <GradeForm onGraded={addGraded} onClose={() => setShowGrade(false)} />
      )}

      <div className={`submissions-source${loadError ? ' submissions-source--error' : ''}`} role={loadError ? 'alert' : undefined}>
        <strong>AI assessment:</strong>{' '}
        {loading && 'loading results…'}
        {!loading && !assessmentConfigured && 'demo mode: the assessment agent is not configured, so these are sample students.'}
        {!loading && assessmentConfigured && loadError && `${loadError} No results can be shown until it is reachable.`}
        {!loading && assessmentConfigured && !loadError && `connected · ${ASSIGNMENT_ID}`}
      </div>

      <div className="submissions-toolbar">
        <label htmlFor="submissions-sort">Sort by</label>
        <select id="submissions-sort" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
          <option value="lastName">Last name</option>
          <option value="score">Score</option>
          <option value="status">Status</option>
        </select>
        <button
          className="btn-outline"
          onClick={() => setDescending(d => !d)}
          aria-label={descending ? 'Descending, switch to ascending' : 'Ascending, switch to descending'}
        >
          {descending ? '↓ Descending' : '↑ Ascending'}
        </button>
      </div>

      <div className="submissions-scroll">
        <table className="submissions-table submissions-table--sticky">
          <thead>
            <tr>
              <th>Student</th>
              <th>Score</th>
              <th>Status</th>
              <th>AI Feedback</th>
              <th style={{ textAlign: 'right' }}>Download</th>
            </tr>
          </thead>
          <tbody>
            {!loading && !loadError && rows.length === 0 && (
              <tr><td colSpan={5} className="submissions-empty">No graded submissions yet for {ASSIGNMENT_ID}.</td></tr>
            )}
            {rows.map(row => {
              const isOpen = expanded === row.id;
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`submission-row-clickable${isOpen ? ' submission-row-open' : ''}`}
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(row.id)}
                    onKeyDown={e => {
                      // Keys pressed on a button inside the row (Download) must reach that button.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(row.id); }
                    }}
                  >
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td style={{ fontWeight: 600 }}>
                      {row.score ?? '—'}
                      <span className="score-max"> / {row.maxScore}</span>
                    </td>
                    <td>
                      {statusBadge(row.status)}
                      {row.mock && <span className="badge badge-mock" title="Graded without an API key">Mock grade</span>}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{row.feedback}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="download-link" onClick={e => e.stopPropagation()}>Download</button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="submission-preview-row">
                      <td colSpan={5}>
                        <div className="submission-preview">
                          {row.submissionText !== null ? (
                            <div>
                              <div className="preview-label">Submission</div>
                              <p>{row.submissionText}</p>
                            </div>
                          ) : (
                            row.files.length > 0 && (
                              <div>
                                <div className="preview-label">Submitted files</div>
                                <p>{row.files.join(', ')}</p>
                              </div>
                            )
                          )}
                          {row.regradeOf && (
                            <div>
                              <div className="preview-label">Regraded</div>
                              <p>
                                Regrade of submission {row.regradeOf}
                                {row.regradeInstructions ? `, with notes: “${row.regradeInstructions}”` : ', without notes.'}
                              </p>
                            </div>
                          )}
                          <List title="Review reasons" items={row.reasons} />
                          <List title="Grading" items={row.grading} />
                          {row.feedback && (
                            <div>
                              <div className="preview-label">AI feedback</div>
                              <p>{row.feedback}</p>
                            </div>
                          )}
                          <List title="Strengths" items={row.strengths} />
                          <List title="Improvements" items={row.improvements} />
                          {row.status === 'Reviewed' && (
                            <div>
                              <div className="preview-label">Your grade</div>
                              <p>
                                {row.score}/{row.maxScore}
                                {row.aiScore !== null && row.aiScore !== row.score ? ` (the AI gave ${row.aiScore})` : ''}
                                {row.instructorNotes ? ` — ${row.instructorNotes}` : ''}
                              </p>
                            </div>
                          )}
                          {row.submissionId && (
                            <ReviewForm
                              key={`${row.id}-${row.status}`}
                              submissionId={row.submissionId}
                              maxScore={row.maxScore}
                              initialScore={row.score}
                              initialNotes={row.instructorNotes}
                              onReviewed={result => replaceRow(row.id, result)}
                            />
                          )}
                          {row.submissionId && (
                            <RegradeForm
                              submissionId={row.submissionId}
                              onRegraded={result => replaceRow(row.id, result)}
                            />
                          )}
                          {row.hasDetails && (
                            <button className="btn-outline" onClick={() => onSelectStudent(row.name)}>Full student details</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
