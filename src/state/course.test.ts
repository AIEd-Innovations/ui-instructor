import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCourse, getCourseId, setCourse, subscribeCourse, withCourse } from './course';

beforeEach(() => setCourse('csc580'));

describe('the current course', () => {
  it('starts as the default and can be switched', () => {
    expect(getCourseId()).toBe('csc580');
    setCourse('abc', 'CSC 580');
    expect(getCourse()).toEqual({ id: 'abc', name: 'CSC 580' });
  });

  it('only tells subscribers when something changed', () => {
    const listener = vi.fn();
    const stop = subscribeCourse(listener);
    setCourse('csc580');
    expect(listener).not.toHaveBeenCalled();
    setCourse('abc');
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    setCourse('def');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('withCourse', () => {
  it('adds the course to a path with or without a query', () => {
    expect(withCourse('/results', 'a b')).toBe('/results?course_id=a%20b');
    expect(withCourse('/results?latest=true', 'abc')).toBe('/results?latest=true&course_id=abc');
  });

  it('leaves a path that already names a course alone', () => {
    expect(withCourse('/x?course_id=other', 'abc')).toBe('/x?course_id=other');
  });

  it('uses the current course by default', () => {
    setCourse('now');
    expect(withCourse('/x')).toBe('/x?course_id=now');
  });
});
