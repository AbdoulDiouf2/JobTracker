import { format } from 'date-fns';

export const toInterviewLocalInput = (value) => {
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  return format(new Date(hasOffset ? value : `${value}Z`), "yyyy-MM-dd'T'HH:mm");
};

export const fromInterviewLocalInput = (value) => new Date(value).toISOString();

export const hasValidInterviewDate = (value) => Boolean(value) && !Number.isNaN(new Date(value).getTime());

export const formatInterviewDate = (value, pattern, locale, fallback) =>
  hasValidInterviewDate(value) ? format(new Date(value), pattern, { locale }) : fallback;
