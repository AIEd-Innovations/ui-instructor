import { describe, expect, it } from 'vitest';
import { csvCell, gradesCsv, safeFileName, studentReport } from './exportRows';
import { SAMPLE_ROWS } from './submissionRows';
import type { SubmissionRow } from './submissionRows';

function row(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
  return { ...SAMPLE_ROWS[0], ...overrides };
}

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('leaves plain values and empties alone', () => {
    expect(csvCell(92)).toBe('92');
    expect(csvCell(null)).toBe('');
    expect(csvCell(false)).toBe('false');
  });
});

describe('gradesCsv', () => {
  it('has a header and one line per student, in the order given', () => {
    const csv = gradesCsv([row({ name: 'Zed Z', score: 50 }), row({ name: 'Amy A', score: 90 })]);
    const lines = csv.replace(String.fromCharCode(0xfeff), '').trimEnd().split('\r\n');
    expect(lines[0]).toBe('Student,Score,Out of,Status,Mock grade,Feedback,Review reasons');
    expect(lines[1].startsWith('Zed Z,50,100,')).toBe(true);
    expect(lines[2].startsWith('Amy A,90,100,')).toBe(true);
  });

  it('leaves the score empty when grading failed', () => {
    expect(gradesCsv([row({ score: null })])).toContain(',,100,');
  });

  it('flags mock grades and joins review reasons', () => {
    const csv = gradesCsv([row({ mock: true, reasons: ['a', 'b'] })]);
    expect(csv).toContain(',yes,');
    expect(csv).toContain('a; b');
  });
});

describe('studentReport', () => {
  it('shows the score, feedback and grading lines', () => {
    const text = studentReport(row({ name: 'Alex M', score: 92, feedback: 'Nice.', grading: ['-5: edge case'] }), 'hw1');
    expect(text).toContain('# Alex M — hw1');
    expect(text).toContain('Score: 92 / 100');
    expect(text).toContain('Nice.');
    expect(text).toContain('- -5: edge case');
  });

  it('says so when it is a mock grade or not graded', () => {
    const text = studentReport(row({ mock: true, score: null }), 'hw1');
    expect(text).toContain('not graded');
    expect(text).toContain('mock grade');
  });
});

describe('safeFileName', () => {
  it('replaces anything unsafe', () => {
    expect(safeFileName('Alex M / hw1')).toBe('Alex_M_hw1');
    expect(safeFileName('///')).toBe('file');
  });
});
