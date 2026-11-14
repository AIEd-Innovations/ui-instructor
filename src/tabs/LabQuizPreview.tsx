import { useState } from 'react';

import { exportUrl, stepStatus } from '../api/curriculum';
import { ApprovalPill, ErrorState, LoadingState, Notice, RefineBar, TypoCheck } from '../components/labBits';
import { useLab } from '../state/labStore';

const TYPE_LABEL: Record<string, string> = {
  short_answer: 'Short answer',
  multiple_choice: 'Multiple choice',
  code: 'Code',
  essay: 'Essay',
};

export default function LabQuizPreview() {
  const { lab, loading, error, notGenerated, busy, refresh, approveStep, generateStep } = useLab();
  const [showAnswers, setShowAnswers] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <LoadingState what="quiz" />;
  if (error) return <ErrorState message={error} onRetry={() => void refresh()} />;

  if (notGenerated || !lab) {
    return (
      <div className="content-card empty-state">
        <h2>No quiz yet</h2>
        <p>Generate the lab spec first, in the Lab Tasks tab. The quiz comes after you approve it.</p>
      </div>
    );
  }

  const totalPoints = lab.quiz.reduce((sum, question) => sum + question.rubric_points, 0);

  const specStatus = stepStatus(lab, 'spec');
  const quizStatus = stepStatus(lab, 'quiz');
  const rubricStatus = stepStatus(lab, 'rubric');
  const hasQuiz = lab.quiz.length > 0;
  const hasRubric = lab.rubric.criteria.length > 0;

  async function act(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  if (specStatus !== 'approved') {
    return (
      <div className="content-card empty-state">
        <h2>Approve the spec first</h2>
        <p>The quiz is written from the approved lab spec. Review and approve it in the Lab Tasks tab.</p>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="content-header">
        <div className="content-title">
          <h2>{lab.title} — Quiz</h2>
          <p>
            {lab.quiz.length} questions · {totalPoints} points · version {lab.version} ·{' '}
            Quiz <ApprovalPill status={quizStatus} />
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
            onClick={() => void act(() => approveStep('quiz'))}
            disabled={busy || !hasQuiz || quizStatus === 'approved'}
          >
            {quizStatus === 'approved' ? 'Quiz approved' : 'Approve quiz'}
          </button>
        </div>
      </div>

      <hr className="content-divider" />

      <TypoCheck />

      {actionError && <Notice kind="error">{actionError}</Notice>}

      {!hasQuiz && (
        <div className="empty-state">
          <p>The spec is approved. Generate the quiz from it.</p>
          <button className="btn-primary" disabled={busy} onClick={() => void act(() => generateStep('quiz'))}>
            {busy ? 'Generating…' : 'Generate quiz'}
          </button>
        </div>
      )}

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

      {hasQuiz && (
        <>
          <RefineBar
            placeholder='e.g. "Make Q3 harder" or "Add a question about cycle detection"'
            hint="Rewrites the quiz with your feedback and bumps the version. The rubric has to be approved again afterwards."
            disabled={busy}
            onSend={feedback => generateStep('quiz', feedback)}
          />

          <h3 className="section-heading">
            Rubric {hasRubric && <ApprovalPill status={rubricStatus} />}
          </h3>
          {quizStatus !== 'approved' && (
            <Notice kind="info">Approve the quiz to unlock the rubric.</Notice>
          )}
          {quizStatus === 'approved' && !hasRubric && (
            <div className="empty-state">
              <p>The quiz is approved. Generate the rubric from it.</p>
              <button className="btn-primary" disabled={busy} onClick={() => void act(() => generateStep('rubric'))}>
                {busy ? 'Generating…' : 'Generate rubric'}
              </button>
            </div>
          )}
          {hasRubric && (
            <>
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
              <button
                className="btn-approve"
                onClick={() => void act(() => approveStep('rubric'))}
                disabled={busy || rubricStatus === 'approved'}
              >
                {rubricStatus === 'approved' ? 'Rubric approved' : 'Approve rubric'}
              </button>
              <RefineBar
                placeholder='e.g. "Weight correctness higher" or "Add a criterion for testing"'
                hint="Rewrites the rubric with your feedback."
                disabled={busy}
                onSend={feedback => generateStep('rubric', feedback)}
              />
            </>
          )}
        </>
      )}

      {lab.feedback_history.length > 0 && (
        <>
          <h3 className="section-heading">Change requests</h3>
          <ul className="objective-list">
            {lab.feedback_history.map(entry => (
              <li key={`${entry.requested_at}-${entry.resulting_version}`}>
                v{entry.resulting_version}{entry.step && entry.step !== 'all' ? ` (${entry.step})` : ''}: {entry.feedback}
              </li>
            ))}
          </ul>
        </>
      )}

    </div>
  );
}
