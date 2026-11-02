// UI-only configuration seam. Replace these stubs with the instructor config API
// when persisted agent settings are available.
export type AgentConfig = {
  id: 'lab-companion' | 'curriculum-designer' | 'assessment-agent' | 'integrity-agent';
  name: string;
  description: string;
  settingsNote: string;
  recommendedApproach: string;
  strictnessHelp: string;
  instructions: string;
  tone: 'Encouraging' | 'Neutral' | 'Direct' | 'Analytical';
  strictness: 'Flexible' | 'Balanced' | 'High';
  supportStyle: 'Socratic questions' | 'Progressive hints' | 'Concise feedback' | 'Detailed explanations';
  feedbackFocus: 'Build understanding' | 'Build confidence' | 'Improve accuracy' | 'Encourage reflection';
  guardrail: 'Never give a full answer' | 'Ask for an attempt first' | 'Escalate uncertainty to the instructor' | 'Only use approved course materials';
};

const mockAgentConfigs: AgentConfig[] = [
  {
    id: 'lab-companion',
    name: 'Lab Companion',
    description: 'Guides students through lab work with questions and progressively more specific hints.',
    settingsNote: 'These settings affect the help students receive while they work through a lab.',
    recommendedApproach: 'Start with a guiding question, then offer one small hint at a time. Keep the student doing the thinking and never provide a complete solution.',
    strictnessHelp: 'Higher strictness makes the tutor more consistent about withholding full solutions.',
    instructions: 'Use guided questions before hints. Do not provide complete solutions; help students reason through the next step.',
    tone: 'Encouraging',
    strictness: 'High',
    supportStyle: 'Progressive hints',
    feedbackFocus: 'Build understanding',
    guardrail: 'Never give a full answer',
  },
  {
    id: 'curriculum-designer',
    name: 'Curriculum Designer',
    description: 'Creates lab tasks, quizzes, and rubrics from the course materials instructors provide.',
    settingsNote: 'These settings shape the scope, voice, and rigor of generated learning materials.',
    recommendedApproach: 'Build from the supplied course materials and learning objectives. Sequence practice from foundational skills to applied work.',
    strictnessHelp: 'Higher strictness keeps generated materials closer to the supplied objectives and source material.',
    instructions: 'Align tasks to the provided materials and learning objectives. Include practice that builds from fundamentals to application.',
    tone: 'Neutral',
    strictness: 'Balanced',
    supportStyle: 'Detailed explanations',
    feedbackFocus: 'Build understanding',
    guardrail: 'Only use approved course materials',
  },
  {
    id: 'assessment-agent',
    name: 'Assessment Agent',
    description: 'Reviews student submissions and identifies work that needs instructor attention.',
    settingsNote: 'These settings affect how consistently submissions are evaluated against the lab rubric.',
    recommendedApproach: 'Use the lab rubric as the source of truth, explain the evidence behind scores, and escalate uncertain cases to the instructor.',
    strictnessHelp: 'Higher strictness applies rubric criteria more consistently and flags borderline work for review.',
    instructions: 'Assess work against the rubric and explain the evidence behind each score. Flag uncertain cases for instructor review.',
    tone: 'Analytical',
    strictness: 'High',
    supportStyle: 'Concise feedback',
    feedbackFocus: 'Improve accuracy',
    guardrail: 'Escalate uncertainty to the instructor',
  },
  {
    id: 'integrity-agent',
    name: 'Integrity Agent',
    description: 'Looks for unusual similarities and patterns that may warrant an instructor review.',
    settingsNote: 'These settings affect how cautiously potential integrity concerns are surfaced.',
    recommendedApproach: 'Surface patterns with clear supporting evidence for instructor review. Do not make a final misconduct determination.',
    strictnessHelp: 'Higher strictness makes the agent more likely to surface borderline patterns for review.',
    instructions: 'Flag patterns for review only when there is clear supporting evidence. Never make a final misconduct determination.',
    tone: 'Direct',
    strictness: 'Balanced',
    supportStyle: 'Detailed explanations',
    feedbackFocus: 'Improve accuracy',
    guardrail: 'Escalate uncertainty to the instructor',
  },
];

export async function fetchAgentConfigs(): Promise<AgentConfig[]> {
  return mockAgentConfigs.map(config => ({ ...config }));
}

export async function saveAgentConfigs(configs: AgentConfig[]): Promise<void> {
  // Intentional placeholder until agent configuration persistence is available.
  console.info('Agent configuration changes (not yet persisted):', configs);
}
