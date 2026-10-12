import { useState } from 'react';

import { exportUrl } from '../api/curriculum';
import { ApprovalPill, ErrorState, LoadingState, Notice, RefineBar } from '../components/labBits';
import { useLab } from '../state/labStore';

const TYPE_LABEL: Record<string, string> = {
  short_answer: 'Short answer',
  multiple_choice: 'Multiple choice',
  code: 'Code',
  essay: 'Essay',
};

export default function LabQuizPreview() {
  const { lab, loading, error, notGenerated, busy, refresh, approve, requestChanges } = useLab();
  const [showAnswers, setShowAnswers] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <LoadingState what="quiz" />;
  if (error) return <ErrorState message={error} onRetry={() => void refresh()} />;

  if (notGenerated || !lab) {
    return (
      <div className="content-card empty-state">
        <h2>No quiz yet</h2>
        <p>Generate the lab material first — the quiz is produced alongside the spec.</p>
      </div>
    );
  }

  const totalPoints = lab.quiz.reduce((sum, question) => sum + question.rubric_points, 0);

  async function onApprove() {
    setActionError(null);
    try {
      await approve();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="content-card">
      <div className="content-header">
        <div className="content-title">
          <h2>{lab.title} — Quiz</h2>
          <p>
            {lab.quiz.length} questions · {totalPoints} points · version {lab.version} ·{' '}
            <ApprovalPill status={lab.approval_status} />
          </p>
        </div>
        <div className="content-actions">
          <button className="btn-outline" onClick={() => setShowAnswers(a => !a)}>
            {showAnswers ? 'Hide answers' : 'Show answers'}
          </button>
          <a className="btn-outline" href={exportUrl('quiz')} target="_blank" rel="noreferrer">
            Export PDF
          </a>
          <div className="content-actions-divider" />
          <button
            className="btn-approve"
            onClick={() => void onApprove()}
            disabled={busy || lab.approval_status === 'approved'}
          >
            {lab.approval_status === 'approved' ? 'Approved' : 'Approve'}
          </button>
        </div>
      </div>

      <hr className="content-divider" />

      {actionError && <Notice kind="error">{actionError}</Notice>}

      {lab.quiz.length === 0 && <Notice kind="info">The agent returned no questions.</Notice>}

      {lab.quiz.map((question, index) => (
        <div key={question.id} className="question-item">
          <div className="question-meta">
            <span className="question-number">Q{index + 1}</span>
            <span className="badge badge-review">{TYPE_LABEL[question.type] ?? question.type}</span>
            <span className="question-tag">{question.difficulty}</span>
            <span className="question-tag">{question.rubric_points} pts</span>
            {question.learning_objective_ref && (
              <span className="question-tag">{question.learning_objective_ref}</span>
            )}
          </div>
          <div className="question-text">{question.question}</div>
          {showAnswers && (
            <div className="question-answer">
              <strong>Expected:</strong> {question.expected_answer}
            </div>
          )}
        </div>
      ))}

      <h3 className="section-heading">Rubric</h3>
      <p className="source-note">
        Code {Math.round(lab.rubric.code_weight * 100)}% · Report{' '}
        {Math.round(lab.rubric.report_weight * 100)}% · Manual{' '}
        {Math.round(lab.rubric.manual_weight * 100)}%
      </p>
      <ul className="objective-list">
        {lab.rubric.criteria.map(criterion => (
          <li key={criterion.name}>
            <strong>{criterion.name}</strong> ({Math.round(criterion.weight * 100)}%) —{' '}
            {criterion.description}
          </li>
        ))}
      </ul>

      {lab.feedback_history.length > 0 && (
        <>
          <h3 className="section-heading">Change requests</h3>
          <ul className="objective-list">
            {lab.feedback_history.map(entry => (
              <li key={`${entry.requested_at}-${entry.resulting_version}`}>
                v{entry.resulting_version}: {entry.feedback}
              </li>
            ))}
          </ul>
        </>
      )}

      <RefineBar
        placeholder='e.g. "Make Q3 harder" or "Add a question about cycle detection"'
        hint="Regenerates the quiz and rubric with your feedback, and bumps the version."
        disabled={busy}
        onSend={requestChanges}
      />
    </div>
  );
}
