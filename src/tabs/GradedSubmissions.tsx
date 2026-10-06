import { Fragment, useState } from 'react';
import './GradedSubmissions.css';

type SubmissionStatus = 'Graded' | 'Flagged ⚠' | 'Needs Review';

interface Submission {
  firstName: string;
  lastName: string;
  score: number;
  status: SubmissionStatus;
  feedback: string;
  // Mock preview data; will come from a GET to the database / assessment agent.
  submission: string;
  grading: string[];
}

const submissions: Submission[] = [
  { firstName: 'Alex', lastName: 'M', score: 92, status: 'Graded', feedback: 'Well-structured logic. Minor edge case missed on traversal.',
    submission: 'Implemented Node, insert_head, delete and traverse. Report discusses O(1) head insertion.',
    grading: ['-5: traversal fails on an empty list', '-3: report omits the deletion case'] },
  { firstName: 'Bella', lastName: 'K', score: 88, status: 'Graded', feedback: 'Good pointer management. Review head-node deletion.',
    submission: 'Full implementation with tests for insert and delete. Report is brief.',
    grading: ['-8: deleting the head node leaves a dangling reference', '-4: report lacks analysis'] },
  { firstName: 'Carlos', lastName: 'R', score: 45, status: 'Flagged ⚠', feedback: '87% similarity + excessive AI usage. Pending review.',
    submission: 'Code closely matches another submission, including identical variable names and comments.',
    grading: ['-30: tasks 2 and 3 incomplete', '-25: flagged for similarity, pending instructor review'] },
  { firstName: 'Dana', lastName: 'W', score: 85, status: 'Graded', feedback: 'Solid work. Deletion edge case handled correctly.',
    submission: 'Clean implementation with docstrings. Cycle detection included as a bonus.',
    grading: ['-10: no tests for traversal', '-5: inconsistent naming'] },
  { firstName: 'Ethan', lastName: 'L', score: 62, status: 'Graded', feedback: 'Task 1 complete. Task 2 incomplete — pointer logic missing.',
    submission: 'Task 1 complete. Task 2 stops after creating nodes; links are never set.',
    grading: ['-30: task 2 pointer logic missing', '-8: no report'] },
  { firstName: 'Fiona', lastName: 'S', score: 79, status: 'Graded', feedback: 'Memory management correct. Minor style issues.',
    submission: 'Correct implementation with explicit cleanup. Long functions, few comments.',
    grading: ['-12: style and readability', '-9: report missing edge cases'] },
  { firstName: 'Jake', lastName: 'N', score: 71, status: 'Needs Review', feedback: 'Partial completion. Needs manual review for task 3.',
    submission: 'Tasks 1 and 2 complete. Task 3 uses an approach the grader could not match to the solution.',
    grading: ['-15: task 3 unverified, needs manual review', '-14: partial report'] },
  { firstName: 'Nina', lastName: 'Q', score: 48, status: 'Flagged ⚠', feedback: '87% similarity with Carlos R. Pending review.',
    submission: 'Code closely matches Carlos R. Same structure and the same unusual comments.',
    grading: ['-27: tasks 2 and 3 incomplete', '-25: flagged for similarity, pending instructor review'] },
];

type SortKey = 'lastName' | 'score' | 'status';

// Lower rank sorts first in ascending order: items needing attention come first.
const STATUS_RANK: Record<SubmissionStatus, number> = { 'Flagged ⚠': 0, 'Needs Review': 1, 'Graded': 2 };

function compare(a: Submission, b: Submission, key: SortKey): number {
  if (key === 'score') return a.score - b.score;
  if (key === 'status') return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
}

function statusBadge(status: SubmissionStatus) {
  if (status === 'Graded') return <span className="badge badge-graded">Graded</span>;
  if (status === 'Flagged ⚠') return <span className="badge badge-flagged">Flagged ⚠</span>;
  return <span className="badge badge-review">Needs Review</span>;
}

function fullName(row: Submission) {
  return `${row.firstName} ${row.lastName}`;
}

export default function GradedSubmissions({ onSelectStudent }: { onSelectStudent: (name: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('lastName');
  const [descending, setDescending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = [...submissions].sort((a, b) => (descending ? -1 : 1) * compare(a, b, sortKey));

  function toggle(name: string) {
    setExpanded(current => (current === name ? null : name));
  }

  return (
    <div className="content-card">
      <div className="content-header">
        <div className="content-title">
          <h2>Student Submissions — Lab 4</h2>
          <p>35 submissions · 30 auto-graded · 3 pending review</p>
        </div>
        <div className="content-actions">
          <button className="btn-outline">Download All (CSV)</button>
          <button className="btn-primary">Grade Submissions</button>
        </div>
      </div>
      <hr className="content-divider" />

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
            {rows.map(row => {
              const name = fullName(row);
              const isOpen = expanded === name;
              return (
                <Fragment key={name}>
                  <tr
                    className={`submission-row-clickable${isOpen ? ' submission-row-open' : ''}`}
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(name)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(name); } }}
                  >
                    <td style={{ fontWeight: 500 }}>{name}</td>
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
                            <p>{row.submission}</p>
                          </div>
                          <div>
                            <div className="preview-label">Grading</div>
                            <ul>
                              {row.grading.map(item => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                          <div>
                            <div className="preview-label">AI feedback</div>
                            <p>{row.feedback}</p>
                          </div>
                          <button className="btn-outline" onClick={() => onSelectStudent(name)}>Full student details</button>
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
