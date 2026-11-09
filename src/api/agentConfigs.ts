import {
  getAssessmentAgentConfig,
  saveAssessmentAgentConfig,
  type AssessmentAgentConfigPayload,
} from './assessment';

// What the "Customize Tutor Behavior" modal shows for each agent. Each agent declares its own
// settings. The Curriculum Designer and Assessment Agent save through their APIs; the Lab Companion
// and Guardian are previews until their services expose settings.

export type AgentId = 'curriculum-designer' | 'lab-companion' | 'assessment-agent' | 'guardian';

export interface SelectField {
  kind: 'select';
  key: string;
  label: string;
  help: string;
  options: readonly string[];
}

export interface TextField {
  kind: 'text';
  key: string;
  label: string;
  help: string;
  placeholder: string;
  /** Offer to load the text from a .txt or .md file. */
  fileImport?: boolean;
}

export type AgentField = SelectField | TextField;
export type AgentValues = Record<string, string>;

export interface AgentDefinition {
  id: AgentId;
  name: string;
  description: string;
  settingsNote: string;
  /** False when nothing is saved yet: the settings are a preview. */
  persisted: boolean;
  fields: AgentField[];
  defaults: AgentValues;
}

export const AGENTS: AgentDefinition[] = [
  {
    id: 'curriculum-designer',
    name: 'Curriculum Designer',
    description: 'Creates lab tasks, quizzes and rubrics from the course materials you upload.',
    settingsNote: 'Your instructions are stored with the lab and included every time it is generated or regenerated.',
    persisted: true,
    fields: [
      {
        kind: 'text',
        key: 'instructions',
        label: 'Instructions for the agent',
        help: 'For example the scope, difficulty or style you want in generated labs.',
        placeholder: 'e.g. "Keep tasks short and build from the lecture examples. Include one stretch task."',
        fileImport: true,
      },
    ],
    defaults: { instructions: '' },
  },
  {
    id: 'lab-companion',
    name: 'Lab Companion',
    description: 'Helps students while they work through a lab, with questions and progressively more specific hints.',
    settingsNote: 'These settings affect the help students get during a lab.',
    persisted: false,
    fields: [
      { kind: 'select', key: 'tone', label: 'Tone', help: 'How the tutor talks to students.', options: ['Encouraging', 'Neutral', 'Direct'] },
      {
        kind: 'select', key: 'support_style', label: 'Teaching style', help: 'How the tutor gives help.',
        options: ['Socratic questions', 'Progressive hints', 'Concise explanations', 'Detailed explanations'],
      },
      {
        kind: 'select', key: 'boundary', label: 'Important boundary', help: 'A rule the tutor always follows.',
        options: ['Never give a full answer', 'Ask for an attempt first', 'Only use approved course materials'],
      },
    ],
    defaults: { tone: 'Encouraging', support_style: 'Progressive hints', boundary: 'Never give a full answer' },
  },
  {
    id: 'assessment-agent',
    name: 'Assessment Agent',
    description: 'Grades each submission against the assignment’s rubric and writes feedback for the student.',
    settingsNote: 'These preferences apply to every submission for this assignment. The rubric always decides the points available.',
    persisted: true,
    fields: [
      {
        kind: 'select', key: 'tone', label: 'Feedback tone', help: 'How the written feedback reads.',
        options: ['Encouraging', 'Neutral', 'Direct'],
      },
      {
        kind: 'select', key: 'feedback_detail', label: 'Feedback detail', help: 'How much the feedback says.',
        options: ['Brief', 'Standard', 'Detailed'],
      },
      {
        kind: 'select', key: 'partial_credit', label: 'Partial credit',
        help: 'How much credit partly correct work gets. This changes scores.',
        options: ['Generous', 'Balanced', 'Strict'],
      },
      {
        kind: 'text', key: 'notes', label: 'Notes for the grader',
        help: 'Standing instructions for every submission, within the rubric.',
        placeholder: 'e.g. "Comments are not required. Accept any correct sorting algorithm."',
      },
    ],
    defaults: { tone: 'Neutral', feedback_detail: 'Standard', partial_credit: 'Balanced', notes: '' },
  },
  {
    id: 'guardian',
    name: 'Guardian',
    description: 'Checks students’ questions to the Lab Companion, and its answers, against course policy, such as asking for a full solution.',
    settingsNote: 'These settings affect when policy violations are escalated to you.',
    persisted: false,
    fields: [
      {
        kind: 'select', key: 'violation_threshold', label: 'Escalate after', help: 'Violations in one session before it is escalated.',
        options: ['1 violation', '2 violations', '3 violations', '5 violations'],
      },
      {
        kind: 'select', key: 'auto_escalate', label: 'At that point', help: 'Whether to send it to you or only mark it.',
        options: ['Escalate to me', 'Only flag it'],
      },
      {
        kind: 'select', key: 'starting_guidance', label: 'Starting guidance', help: 'How much help a session starts with, before any violation.',
        options: ['Full', 'Moderate', 'Minimal'],
      },
    ],
    defaults: { violation_threshold: '3 violations', auto_escalate: 'Escalate to me', starting_guidance: 'Full' },
  },
];

// ── Assessment Agent ────────────────────────────────────────────────────────

export async function loadAssessmentValues(): Promise<AgentValues> {
  const config = await getAssessmentAgentConfig();
  return {
    tone: config.tone,
    feedback_detail: config.feedback_detail,
    partial_credit: config.partial_credit,
    notes: config.notes,
  };
}

export function toAssessmentPayload(values: AgentValues): AssessmentAgentConfigPayload {
  return {
    tone: values.tone as AssessmentAgentConfigPayload['tone'],
    feedback_detail: values.feedback_detail as AssessmentAgentConfigPayload['feedback_detail'],
    partial_credit: values.partial_credit as AssessmentAgentConfigPayload['partial_credit'],
    notes: values.notes.trim(),
  };
}

export async function saveAssessmentValues(values: AgentValues): Promise<void> {
  await saveAssessmentAgentConfig(toAssessmentPayload(values));
}

// ── Saving ──────────────────────────────────────────────────────────────────

export type Saver = (values: AgentValues) => Promise<unknown>;

export interface SaveOutcome {
  saved: AgentId[];
  failed: { id: AgentId; message: string }[];
}

/** Save each changed agent that has a saver. One failure does not stop the others. */
export async function saveChanged(
  changed: { id: AgentId; values: AgentValues }[],
  savers: Partial<Record<AgentId, Saver>>,
): Promise<SaveOutcome> {
  const outcome: SaveOutcome = { saved: [], failed: [] };
  for (const { id, values } of changed) {
    const save = savers[id];
    if (!save) continue;
    try {
      await save(values);
      outcome.saved.push(id);
    } catch (e) {
      outcome.failed.push({ id, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return outcome;
}
