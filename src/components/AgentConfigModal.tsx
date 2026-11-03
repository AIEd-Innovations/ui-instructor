import { useEffect, useState } from 'react';
import Modal from './Modal';
import { fetchAgentConfigs, saveAgentConfigs, type AgentConfig } from '../api/agentConfigs';

interface Props {
  onClose: () => void;
}

type View = 'overview' | 'customize' | 'manual';

const tones: AgentConfig['tone'][] = ['Encouraging', 'Neutral', 'Direct', 'Analytical'];
const strictnessLevels: AgentConfig['strictness'][] = ['Flexible', 'Balanced', 'High'];
const supportStyles: AgentConfig['supportStyle'][] = ['Socratic questions', 'Progressive hints', 'Concise feedback', 'Detailed explanations'];
const feedbackFocuses: AgentConfig['feedbackFocus'][] = ['Build understanding', 'Build confidence', 'Improve accuracy', 'Encourage reflection'];
const guardrails: AgentConfig['guardrail'][] = ['Never give a full answer', 'Ask for an attempt first', 'Escalate uncertainty to the instructor', 'Only use approved course materials'];

export default function AgentConfigModal({ onClose }: Props) {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [activeId, setActiveId] = useState<AgentConfig['id'] | null>(null);
  const [view, setView] = useState<View>('overview');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchAgentConfigs().then(items => {
      setConfigs(items);
      setActiveId(items[0]?.id ?? null);
    });
  }, []);

  const activeConfig = configs.find(config => config.id === activeId);

  function updateActive(patch: Partial<AgentConfig>) {
    if (!activeId) return;
    setConfigs(items => items.map(item => item.id === activeId ? { ...item, ...patch } : item));
  }

  function selectAgent(id: AgentConfig['id']) {
    setActiveId(id);
    setView('overview');
  }

  async function save() {
    setSaving(true);
    await saveAgentConfigs(configs);
    onClose();
  }

  function selectField<T extends string>(label: string, value: T, options: readonly T[], onChange: (next: T) => void, help: string) {
    return (
      <label className="agent-config-field">
        <span>{label}</span>
        <select value={value} onChange={event => onChange(event.target.value as T)}>
          {options.map(option => <option key={option}>{option}</option>)}
        </select>
        <small>{help}</small>
      </label>
    );
  }

  return (
    <Modal title="Customize tutor behavior" onClose={saving ? () => {} : onClose} width={820}>
      <p className="modal-subtitle">Choose an agent to see what it does, then customize its behavior using guided teaching options.</p>

      <div className="agent-config-layout">
        <div className="agent-config-list" role="tablist" aria-label="AI agents">
          {configs.map(config => (
            <button
              key={config.id}
              className={`agent-config-tab${config.id === activeId ? ' agent-config-tab--active' : ''}`}
              onClick={() => selectAgent(config.id)}
              role="tab"
              aria-selected={config.id === activeId}
            >
              {config.name}
            </button>
          ))}
        </div>

        {activeConfig && (
          <section className="agent-config-content" role="tabpanel">
            {view !== 'overview' && (
              <div className="agent-config-view-tabs" role="tablist" aria-label="Configuration mode">
                <button className={view === 'customize' ? 'active' : ''} onClick={() => setView('customize')}>Guided customization</button>
                <button className={view === 'manual' ? 'active' : ''} onClick={() => setView('manual')}>Manual override</button>
              </div>
            )}

            {view === 'overview' && (
              <div className="agent-config-overview">
                <div className="agent-config-description">
                  <strong>What this agent does</strong>
                  <p>{activeConfig.description}</p>
                  <span>{activeConfig.settingsNote}</span>
                </div>
                <div className="agent-config-recommendation">
                  <strong>Recommended approach</strong>
                  <p>{activeConfig.recommendedApproach}</p>
                  <span>We’ve set a teaching-focused default. You can adjust it with plain-language options—no prompt-writing required.</span>
                </div>
                <button className="btn-primary agent-config-start" onClick={() => setView('customize')}>Customize behavior</button>
              </div>
            )}

            {view === 'customize' && (
              <>
                <p className="agent-config-section-intro">Choose the options that best fit your course. These choices build clear instructions for the agent automatically.</p>
                <div className="agent-config-fields-grid">
                  {selectField('Tone', activeConfig.tone, tones, tone => updateActive({ tone }), 'How the agent communicates with students.')}
                  {selectField('Rule-following', activeConfig.strictness, strictnessLevels, strictness => updateActive({ strictness }), activeConfig.strictnessHelp)}
                  {selectField('Teaching style', activeConfig.supportStyle, supportStyles, supportStyle => updateActive({ supportStyle }), 'How the agent delivers help or feedback.')}
                  {selectField('Primary focus', activeConfig.feedbackFocus, feedbackFocuses, feedbackFocus => updateActive({ feedbackFocus }), 'What the agent should prioritize in each interaction.')}
                  {selectField('Important boundary', activeConfig.guardrail, guardrails, guardrail => updateActive({ guardrail }), 'A rule the agent should always follow.')}
                </div>
                <div className="agent-config-prompt-preview">
                  <strong>Your structured instructions</strong>
                  <p>Use a <b>{activeConfig.tone.toLowerCase()}</b> tone. Use <b>{activeConfig.supportStyle.toLowerCase()}</b> to <b>{activeConfig.feedbackFocus.toLowerCase()}</b>. Follow rules with <b>{activeConfig.strictness.toLowerCase()}</b> consistency. <b>{activeConfig.guardrail}.</b></p>
                </div>
                <div className="agent-config-manual-link">
                  Need something these options don’t cover? <button onClick={() => setView('manual')}>Use the manual override</button>
                </div>
              </>
            )}

            {view === 'manual' && (
              <div className="agent-config-manual">
                <div className="agent-config-description">
                  <strong>Manual prompt override</strong>
                  <p>Write custom instructions only when your course needs rules that the guided options cannot express.</p>
                  <span>This replaces the structured instructions above. You are responsible for ensuring it supports your teaching goals and course policies.</span>
                </div>
                <label className="agent-config-field">
                  <span>Custom instructions</span>
                  <textarea
                    value={activeConfig.instructions}
                    onChange={event => updateActive({ instructions: event.target.value })}
                    placeholder={'Role: Explain the role this agent should play in your course.\n\nTeaching approach: Describe how it should help students learn.\n\nBoundaries: State what it must never do.\n\nEscalation: Explain when it should ask you to review something.'}
                    rows={8}
                  />
                  <small>Include the agent’s role, the desired teaching approach, firm boundaries, and when it should send work to you for review.</small>
                </label>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={() => void save()} disabled={!activeConfig || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </Modal>
  );
}
