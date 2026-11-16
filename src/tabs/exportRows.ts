// Turn the Submissions table into files the instructor can keep: one CSV of every grade, and a
// short report for a single student. Everything comes from the rows already on screen.

import type { SubmissionRow } from './submissionRows';

/**
 * One CSV cell. Quoted when it needs to be. A cell that starts with = + - or @ would be run as a
 * formula by Excel or Sheets, and feedback text comes from a model, so those get a leading quote.
 */
export function csvCell(value: string | number | boolean | null): string {
  let text = value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Byte order mark: Excel needs it to read the file as UTF-8.
const BOM = String.fromCharCode(0xfeff);

const HEADER = ['Student', 'Score', 'Out of', 'Status', 'Mock grade', 'Feedback', 'Review reasons'];

export function gradesCsv(rows: SubmissionRow[]): string {
  const lines = [HEADER.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.score,
        row.maxScore,
        row.status,
        row.mock ? 'yes' : 'no',
        row.feedback,
        row.reasons.join('; '),
      ].map(csvCell).join(','),
    );
  }
  // Windows line endings, as spreadsheets expect.
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

function list(title: string, items: string[]): string {
  return items.length === 0 ? '' : `\n## ${title}\n${items.map(i => `- ${i}`).join('\n')}\n`;
}

/** A readable grade report for one student, as Markdown. */
export function studentReport(row: SubmissionRow, assignment: string): string {
  const score = row.score === null ? 'not graded' : `${row.score} / ${row.maxScore}`;
  return [
    `# ${row.name} — ${assignment}`,
    '',
    `Score: ${score}`,
    `Status: ${row.status}`,
    row.mock ? '\n> This is a mock grade from the offline model, not a real assessment.' : '',
    row.feedback ? `\n## Feedback\n${row.feedback}\n` : '',
    list('Grading', row.grading),
    list('Strengths', row.strengths),
    list('Improvements', row.improvements),
    list('Review reasons', row.reasons),
    row.files.length ? `\nSubmitted files: ${row.files.join(', ')}\n` : '',
  ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** A file name that is safe on every system. */
export function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'file';
}

/** Hand a string to the browser as a download. */
export function downloadText(fileName: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
