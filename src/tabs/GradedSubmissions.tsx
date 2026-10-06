import { Fragment, useEffect, useState } from 'react';
import './GradedSubmissions.css';
import { ASSIGNMENT_ID, assessmentConfigured, getResults } from '../api/assessment';
import { SAMPLE_ROWS, compareRows, rowFromResult } from './submissionRows';
import type { SortKey, SubmissionRow, SubmissionStatus } from './submissionRows';

function statusBadge(status: SubmissionStatus) {
  if (status === 'Graded') return <span className="badge badge-graded">Graded</span>;
  if (status === 'Flagged ⚠') return <span className="badge badge-flagged">Flagged ⚠</span>;
  return <span className="badge badge-review">Needs Review</span>;
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

export default function GradedSubmissions({ onSelectStudent }: { onSelectStudent: (name: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('lastName');
  const [descending, setDescending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // null until the agent has answered; only used when the agent is configured.
  const [liveRows, setLiveRows] = useState<SubmissionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentConfigured) return;
    getResults()
      .then(results => setLiveRows(results.map(rowFromResult)))
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Request failed'));
  }, []);

  const loading = assessmentConfigured && liveRows === null && loadError === null;
  const usingSample = !assessmentConfigured || loadError !== null;
  const data = usingSample ? SAMPLE_ROWS : (liveRows ?? []);
  const rows = [...data].sort((a, b) => (descending ? -1 : 1) * compareRows(a, b, sortKey));

  const graded = data.filter(r => r.status === 'Graded').length;
  const review = data.filter(r => r.status === 'Needs Review').length;
  const flagged = data.filter(r => r.status === 'Flagged ⚠').length;

  function toggle(id: string) {
    setExpanded(current => (current === id ? null : id));
  }

  return (
    <div className="content-card">
      <div className="content-header">
        <div className="content-title">
          <h2>Student Submissions — Lab 4</h2>
          <p>{data.length} submissions · {graded} graded · {review} needs review · {flagged} flagged</p>
        </div>
        <div className="content-actions">
          <button className="btn-outline">Download All (CSV)</button>
          <button className="btn-primary">Grade Submissions</button>
        </div>
      </div>
      <hr className="content-divider" />

      <div className={`submissions-source${loadError ? ' submissions-source--error' : ''}`} role={loadError ? 'alert' : undefined}>
        <strong>AI assessment:</strong>{' '}
        {loading && 'loading results…'}
        {!loading && !assessmentConfigured && 'agent not configured, showing sample data.'}
        {!loading && assessmentConfigured && loadError && `${loadError} Showing sample data.`}
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
            {!loading && rows.length === 0 && (
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
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(row.id); } }}
                  >
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td style={{ fontWeight: 600 }}>{row.score}</td>
                    <td>{statusBadge(row.status)}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{row.feedback}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="download-link" onClick={e => e.stopPropagation()}>Download</button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="submission-preview-row">
                      <td colSpan={5}>
                        <div className="submission-preview">
                          <div>
                            <div className="preview-label">Submission</div>
                            <p>{row.submissionText ?? 'The assessment agent does not store submission text yet.'}</p>
                          </div>
                          <List title="Grading" items={row.grading} />
                          <List title="Integrity flags" items={row.flags} />
                          {row.feedback && (
                            <div>
                              <div className="preview-label">AI feedback</div>
                              <p>{row.feedback}</p>
                            </div>
                          )}
                          <List title="Strengths" items={row.strengths} />
                          <List title="Improvements" items={row.improvements} />
                          <button className="btn-outline" onClick={() => onSelectStudent(row.name)}>Full student details</button>
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
