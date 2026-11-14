import { useState } from 'react';

import { exportUrl, stepStatus } from '../api/curriculum';
import GenerateLabModal from '../components/GenerateLabModal';
import { ApprovalPill, ErrorState, LoadingState, Notice, RefineBar, TypoCheck } from '../components/labBits';
import { useLab } from '../state/labStore';

export default function MaterialPreview() {
  const { lab, loading, error, notGenerated, busy, refresh, generate, approveStep, generateStep } = useLab();
  const [showGenerate, setShowGenerate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <LoadingState what="lab material" />;
  if (error) return <ErrorState message={error} onRetry={() => void refresh()} />;

  const generateModal = showGenerate && (
    <GenerateLabModal
      initialTitle={lab?.title ?? ''}
      initialObjectives={lab?.learning_objectives ?? []}
      replacesExisting={lab !== null}
      onGenerate={generate}
      onClose={() => setShowGenerate(false)}
    />
  );

  if (notGenerated || !lab) {
    return (
      <>
        <div className="content-card empty-state">
          <h2>No lab material yet</h2>
          <p>
            Upload a lecture PDF on the left if you want the agent to work from it, then
            generate the lab spec, quiz and rubric.
          </p>
          <button className="btn-primary" onClick={() => setShowGenerate(true)}>
            Generate Lab Material
          </button>
        </div>
        {generateModal}
      </>
    );
  }

  const specStatus = stepStatus(lab, 'spec');

  async function onApprove() {
    setActionError(null);
    try {
      await approveStep('spec');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <div className="content-card">
        <div className="content-header">
          <div className="content-title">
            <h2>{lab.title}</h2>
            <p>
              {lab.learning_objectives.length} objectives · {lab.estimated_duration_min} min ·
              version {lab.version} · Spec <ApprovalPill status={specStatus} />
            </p>
          </div>
          <div className="content-actions">
            <button className="btn-outline" onClick={() => setShowGenerate(true)} disabled={busy}>
              Start over
            </button>
            <a className="btn-outline" href={exportUrl('lab')} target="_blank" rel="noreferrer">
              Export PDF
            </a>
            <div className="content-actions-divider" />
            <button
              className="btn-approve"
              onClick={() => void onApprove()}
              disabled={busy || specStatus === 'approved'}
            >
              {specStatus === 'approved' ? 'Spec approved' : 'Approve spec'}
            </button>
          </div>
        </div>

        <hr className="content-divider" />

        <TypoCheck />

        {actionError && <Notice kind="error">{actionError}</Notice>}

        {specStatus === 'approved' && lab.approval_status !== 'approved' && (
          <Notice kind="info">Spec approved. Next: generate the quiz in the Lab Quiz tab.</Notice>
        )}

        {lab.approval_status === 'approved' && lab.approved_by && (
          <Notice kind="info">
            Lab approved by {lab.approved_by}
            {lab.approval_notes ? ` — ${lab.approval_notes}` : ''}
          </Notice>
        )}

        <h3 className="section-heading">Learning objectives</h3>
        <ul className="objective-list">
          {lab.learning_objectives.map(objective => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>

        <h3 className="section-heading">Lab specification</h3>
        <pre className="spec-text">{lab.spec_markdown}</pre>

        {lab.material_content ? (
          <p className="source-note">
            Generated using {lab.material_content.length.toLocaleString()} characters of
            uploaded material.
          </p>
        ) : (
          <p className="source-note">No uploaded material was used for this lab.</p>
        )}

        <RefineBar
          placeholder='e.g. "Add a section on recursion" or "Make the setup shorter"'
          hint="Feedback rewrites the spec. Once you change it, the quiz and rubric have to be approved again."
          disabled={busy}
          onSend={feedback => generateStep('spec', feedback)}
        />
      </div>
      {generateModal}
    </>
  );
}
