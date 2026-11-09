import { useEffect, useId, useRef, useState } from 'react';
import Modal from './Modal';
import {
  AGENTS,
  loadAssessmentValues,
  saveAssessmentValues,
  saveChanged,
  type AgentDefinition,
  type AgentId,
  type AgentValues,
  type TextField,
} from '../api/agentConfigs';
import { assessmentConfigured } from '../api/assessment';
import { isConfigured as curriculumConfigured } from '../api/curriculum';
import { useLab } from '../state/labStore';

interface Props {
  onClose: () => void;
}

type Status =
  | { state: 'ready' }
  | { state: 'loading' }
  | { state: 'unavailable' | 'error'; message: string };

interface Entry {
  values: AgentValues;
  /** The values as last loaded or saved, to tell what changed. */
  baseline: AgentValues;
  status: Status;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function initialEntries(labInstructions: string): Record<AgentId, Entry> {
  const entries = {} as Record<AgentId, Entry>;
  for (const agent of AGENTS) {
    entries[agent.id] = { values: agent.defaults, baseline: agent.defaults, status: { state: 'ready' } };
  }
  const instructions = { instructions: labInstructions };
  entries['curriculum-designer'] = {
    values: instructions,
    baseline: instructions,
    status: curriculumConfigured()
      ? { state: 'ready' }
      : { state: 'unavailable', message: 'The Curriculum Designer is not connected, so its instructions cannot be saved.' },
  };
  entries['assessment-agent'].status = assessmentConfigured
    ? { state: 'loading' }
    : { state: 'unavailable', message: 'The assessment agent is not connected, so its preferences cannot be loaded or saved.' };
  return entries;
}

function isChanged(entry: Entry): boolean {
  return Object.keys(entry.values).some(key => entry.values[key] !== entry.baseline[key]);
}

function TextInput({ field, value, disabled, onChange }: {
  field: TextField;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function readFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) {
      setError(`${file.name} is not a .txt or .md file.`);
    } else if (file.size > MAX_FILE_BYTES) {
      setError(`${file.name} is over 5 MB.`);
    } else {
      setError(null);
      onChange(await file.text());
    }
  }

  return (
    <div className="agent-config-field agent-config-field--wide">
      <label htmlFor={id}>{field.label}</label>
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={5}
        disabled={disabled}
      />
      <small>{field.help}</small>
      {field.fileImport && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md"
            style={{ display: 'none' }}
            onChange={e => { void readFile(e.target.files); e.target.value = ''; }}
          />
          <button type="button" className="agent-config-file" onClick={() => inputRef.current?.click()} disabled={disabled}>
            Load from a .txt or .md file
          </button>
        </>
      )}
      {error && <div className="notice notice-error">{error}</div>}
    </div>
  );
}

export default function AgentConfigModal({ onClose }: Props) {
  const { lab, uploadInstructions } = useLab();
  const [entries, setEntries] = useState(() => initialEntries(lab?.agent_instructions ?? ''));
  const [activeId, setActiveId] = useState<AgentId>(AGENTS[0].id);
  const [saving, setSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!assessmentConfigured) return;
    let cancelled = false;
    loadAssessmentValues()
      .then(values => {
        if (cancelled) return;
        setEntries(current => ({ ...current, 'assessment-agent': { values, baseline: values, status: { state: 'ready' } } }));
      })
      .catch(e => {
        if (cancelled) return;
        const message = `Could not load the Assessment Agent's preferences. ${e instanceof Error ? e.message : String(e)}`;
        setEntries(current => ({
          ...current,
          'assessment-agent': { ...current['assessment-agent'], status: { state: 'error', message } },
        }));
      });
    return () => { cancelled = true; };
  }, []);

  const agent = AGENTS.find(a => a.id === activeId) as AgentDefinition;
  const entry = entries[activeId];
  const editable = entry.status.state === 'ready' && !saving;
  const changedAgents = AGENTS.filter(a => a.persisted && entries[a.id].status.state === 'ready' && isChanged(entries[a.id]));

  function setValue(key: string, value: string) {
    setEntries(current => ({
      ...current,
      [activeId]: { ...current[activeId], values: { ...current[activeId].values, [key]: value } },
    }));
  }

  async function save() {
    setSaving(true);
    setSaveErrors([]);
    const outcome = await saveChanged(
      changedAgents.map(a => ({ id: a.id, values: entries[a.id].values })),
      {
        'curriculum-designer': values => {
          const text = values.instructions.trim();
          if (!text) throw new Error('Instructions cannot be empty.');
          return uploadInstructions(text);
        },
        'assessment-agent': saveAssessmentValues,
      },
    );
    if (outcome.failed.length === 0) {
      onClose();
      return;
    }
    // Keep what did save, so only the failures are still marked as changed.
    setEntries(current => {
      const next = { ...current };
      for (const id of outcome.saved) next[id] = { ...next[id], baseline: next[id].values };
      return next;
    });
    setSaveErrors(outcome.failed.map(f => `${AGENTS.find(a => a.id === f.id)?.name}: ${f.message}`));
    setSaving(false);
  }

  return (
    <Modal title="Customize agent behavior" onClose={saving ? () => {} : onClose} width={820}>
      <p className="modal-subtitle">Choose an agent to see what it does and adjust how it works in your course.</p>

      <div className="agent-config-layout">
        <div className="agent-config-list" role="tablist" aria-label="AI agents">
          {AGENTS.map(a => (
            <button
              key={a.id}
              className={`agent-config-tab${a.id === activeId ? ' agent-config-tab--active' : ''}`}
              onClick={() => setActiveId(a.id)}
              role="tab"
              aria-selected={a.id === activeId}
            >
              {a.name}
              {!a.persisted && <span className="agent-config-tag">Preview</span>}
              {a.persisted && isChanged(entries[a.id]) && <span className="agent-config-changed" aria-label="unsaved changes">•</span>}
            </button>
          ))}
        </div>

        <section className="agent-config-content" role="tabpanel">
          <div className="agent-config-description">
            <strong>What this agent does</strong>
            <p>{agent.description}</p>
            <span>{agent.settingsNote}</span>
          </div>

          {!agent.persisted && (
            <div className="notice notice-info">
              Preview: these settings are not saved yet. They show what you will be able to change once the {agent.name} supports it.
            </div>
          )}
          {entry.status.state === 'loading' && <div className="notice notice-info">Loading the current settings…</div>}
          {(entry.status.state === 'unavailable' || entry.status.state === 'error') && (
            <div className="notice notice-error">{entry.status.message}</div>
          )}

          <div className="agent-config-fields-grid">
            {agent.fields.map(field => field.kind === 'select' ? (
              <label key={field.key} className="agent-config-field">
                <span>{field.label}</span>
                <select value={entry.values[field.key]} onChange={e => setValue(field.key, e.target.value)} disabled={!editable}>
                  {field.options.map(option => <option key={option}>{option}</option>)}
                </select>
                <small>{field.help}</small>
              </label>
            ) : (
              <TextInput
                key={field.key}
                field={field}
                value={entry.values[field.key]}
                disabled={!editable}
                onChange={value => setValue(field.key, value)}
              />
            ))}
          </div>
        </section>
      </div>

      {saveErrors.length > 0 && (
        <div className="notice notice-error agent-config-save-errors">
          Some changes were not saved:
          <ul>{saveErrors.map(message => <li key={message}>{message}</li>)}</ul>
        </div>
      )}

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={() => void save()} disabled={changedAgents.length === 0 || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
