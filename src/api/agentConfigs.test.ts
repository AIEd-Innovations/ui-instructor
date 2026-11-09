import { describe, expect, it, vi } from 'vitest';
import { AGENTS, saveChanged, toAssessmentPayload } from './agentConfigs';

describe('AGENTS', () => {
  it('gives every field a default, and every select default is one of its options', () => {
    for (const agent of AGENTS) {
      expect(Object.keys(agent.defaults).sort()).toEqual(agent.fields.map(f => f.key).sort());
      for (const field of agent.fields) {
        if (field.kind === 'select') expect(field.options).toContain(agent.defaults[field.key]);
      }
    }
  });

  it('saves only the Curriculum Designer and the Assessment Agent; the others are previews', () => {
    expect(AGENTS.filter(a => a.persisted).map(a => a.id)).toEqual(['curriculum-designer', 'assessment-agent']);
  });

  it("matches the assessment agent's defaults, which leave grading unchanged", () => {
    const assessment = AGENTS.find(a => a.id === 'assessment-agent')!;
    expect(toAssessmentPayload(assessment.defaults)).toEqual({
      tone: 'Neutral', feedback_detail: 'Standard', partial_credit: 'Balanced', notes: '',
    });
  });
});

describe('toAssessmentPayload', () => {
  it('trims the notes', () => {
    const payload = toAssessmentPayload({ tone: 'Direct', feedback_detail: 'Brief', partial_credit: 'Strict', notes: '  Be fair.  ' });
    expect(payload).toEqual({ tone: 'Direct', feedback_detail: 'Brief', partial_credit: 'Strict', notes: 'Be fair.' });
  });
});

describe('saveChanged', () => {
  it('saves each changed agent and reports failures without stopping', async () => {
    const curriculum = vi.fn(async () => { throw new Error('Curriculum Designer is down.'); });
    const assessment = vi.fn(async () => undefined);

    const outcome = await saveChanged(
      [
        { id: 'curriculum-designer', values: { instructions: 'x' } },
        { id: 'assessment-agent', values: { tone: 'Direct' } },
        { id: 'guardian', values: {} },
      ],
      { 'curriculum-designer': curriculum, 'assessment-agent': assessment },
    );

    expect(assessment).toHaveBeenCalledWith({ tone: 'Direct' });
    expect(outcome.saved).toEqual(['assessment-agent']);
    expect(outcome.failed).toEqual([{ id: 'curriculum-designer', message: 'Curriculum Designer is down.' }]);
  });
});
