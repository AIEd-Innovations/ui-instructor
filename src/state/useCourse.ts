import { useSyncExternalStore } from 'react';
import { getCourse, subscribeCourse } from './course';

export function useCourse() {
  return useSyncExternalStore(subscribeCourse, getCourse);
}
