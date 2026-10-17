// Collects the fields POST /curriculum/generate needs. Generation runs several
// LLM calls, so this can take a while — the modal stays open and disabled until
// the agent answers.

import { useState } from 'react';
import Modal from './Modal';
import type { GenerateParams } from '../api/curriculum';

interface Props {
  initialTitle?: string;
  initialObjectives?: string[];
  onGenerate: (params: GenerateParams) => Promise<void>;
  onClose: () => void;
}

export default function GenerateLabModal({
  initialTitle = '',
  initialObjectives = [],
  onGenerate,
  onClose,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [objectives, setObjectives] = useState(initialObjectives.join('\n'));
  const [difficulty, setDifficulty] = useState('intermediate');
  const [duration, setDuration] = useState(90);
  const [weight, setWeight] = useState<GenerateParams['material_weight']>('balanced');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objectiveList = objectives
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const canSubmit = title.trim() !== '' && objectiveList.length > 0 && !working;

  async function submit() {
    if (!canSubmit) return;
    setWorking(true);
    setError(null);
    try {
      await onGenerate({
        title: title.trim(),
        learning_objectives: objectiveList,
        difficulty,
        estimated_duration_min: duration,
        material_weight: weight,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setWorking(false);
    }
  }

  return (
    <Modal title="Generate Lab Material" onClose={working ? () => {} : onClose} width={560}>
      <p className="modal-subtitle">
        The agent writes the lab spec, quiz and rubric from these. Any material you
        uploaded is used as context.
      </p>

      <label className="field">
        <span className="field-label">Lab title</span>
        <input
          className="field-input"
          value={title}
          disabled={working}
          placeholder="e.g. Linked Lists"
          onChange={e => setTitle(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Learning objectives — one per line</span>
        <textarea
          className="modal-textarea"
          rows={5}
          value={objectives}
          disabled={working}
          placeholder={'Implement a singly linked list\nAnalyse insertion and deletion cost'}
          onChange={e => setObjectives(e.target.value)}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Difficulty</span>
          <select
            className="field-input"
            value={difficulty}
            disabled={working}
            onChange={e => setDifficulty(e.target.value)}
          >
            <option value="basic">Basic</option>
            <option value="intermediate">Intermediate</option>
            <option value="challenge">Challenge</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Duration (min)</span>
          <input
            className="field-input"
            type="number"
            min={15}
            step={15}
            value={duration}
            disabled={working}
            onChange={e => setDuration(Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span className="field-label">Use uploaded material</span>
          <select
            className="field-input"
            value={weight}
            disabled={working}
            onChange={e => setWeight(e.target.value as GenerateParams['material_weight'])}
          >
            <option value="strict">Strictly</option>
            <option value="balanced">Balanced</option>
            <option value="expansive">Loosely</option>
          </select>
        </label>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose} disabled={working}>Cancel</button>
        <button className="btn-primary" onClick={() => void submit()} disabled={!canSubmit}>
          {working ? 'Generating… this takes a moment' : 'Generate'}
        </button>
      </div>
    </Modal>
  );
}
