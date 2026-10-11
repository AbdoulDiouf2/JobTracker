import { fromInterviewLocalInput, toInterviewLocalInput, hasValidInterviewDate, formatInterviewDate } from '../lib/interviewDate';

test('converts a UTC interview into browser local time without moving the instant', () => {
  const local = toInterviewLocalInput('2026-10-20T07:00:00Z');
  expect(fromInterviewLocalInput(local)).toBe('2026-10-20T07:00:00.000Z');
});

test('treats historical naive dates as UTC', () => {
  expect(toInterviewLocalInput('2026-10-20T07:00:00'))
    .toBe(toInterviewLocalInput('2026-10-20T07:00:00Z'));
});

test('signals invalid historical dates without showing the Unix epoch', () => {
  expect(hasValidInterviewDate(null)).toBe(false);
  expect(hasValidInterviewDate('not-a-date')).toBe(false);
  expect(formatInterviewDate(null, 'HH:mm', undefined, 'Date invalide')).toBe('Date invalide');
  expect(hasValidInterviewDate('2026-10-20T07:00:00Z')).toBe(true);
});
