import { afterEach, describe, expect, it } from 'vitest';

import {
  assignmentId,
  clearSession,
  courseId,
  hasLab,
  instructorEmail,
  labId,
  newLabId,
  onSignedOut,
  reportSignedOut,
  setIdentity,
  setSelection,
} from './session';

afterEach(() => {
  clearSession();
  onSignedOut(null);
});

describe('the chosen course and lab', () => {
  it('starts empty, so a signed-out tab holds no course', () => {
    expect(courseId()).toBe('');
    expect(labId()).toBe('');
    expect(hasLab()).toBe(false);
  });

  it('keeps the two apart: a new course clears nothing by itself', () => {
    setSelection({ courseId: 'course-1', labId: 'lab-a' });
    setSelection({ courseId: 'course-2' });
    expect(courseId()).toBe('course-2');
    expect(labId()).toBe('lab-a');
    expect(hasLab()).toBe(true);
  });

  it('gives the Assessment Agent the lab id as the assignment id', () => {
    setSelection({ labId: 'sorting-ab12cd' });
    expect(assignmentId()).toBe('sorting-ab12cd');
  });

  it('forgets everything on sign-out', () => {
    setSelection({ courseId: 'course-1', labId: 'lab-a' });
    setIdentity({ email: 'alice@calpoly.edu', userId: 'u1' });
    clearSession();
    expect([courseId(), labId(), instructorEmail()]).toEqual(['', '', '']);
  });
});

describe('a new lab id', () => {
  it('reads as the title, with a suffix so two instructors never collide', () => {
    const id = newLabId('Sorting Algorithms');
    expect(id).toMatch(/^sorting-algorithms-[a-z0-9]{1,6}$/);
    expect(newLabId('Sorting Algorithms')).not.toBe(id);
  });

  it('survives punctuation, accents and a title that slugs to nothing', () => {
    expect(newLabId('Lab #3: Big-O!')).toMatch(/^lab-3-big-o-/);
    expect(newLabId('   ')).toMatch(/^lab-/);
    expect(newLabId('!!!')).toMatch(/^lab-/);
  });

  it('keeps the id short enough to read in a URL', () => {
    const id = newLabId('A very long lab title that goes on and on and on for ages');
    expect(id.length).toBeLessThanOrEqual(32 + 1 + 6);
  });
});

describe('being signed out mid-session', () => {
  it('tells whoever is listening, once a handler is registered', () => {
    let told = 0;
    onSignedOut(() => { told += 1; });
    reportSignedOut();
    expect(told).toBe(1);

    onSignedOut(null);
    reportSignedOut();
    expect(told).toBe(1);
  });
});
