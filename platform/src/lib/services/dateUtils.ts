const DEFAULT_TIME_ZONE = 'America/Vancouver';

export function getWorkflowTimeZone(): string {
  return process.env.WORKFLOW_TIME_ZONE || DEFAULT_TIME_ZONE;
}

export function getLocalDateKey(date = new Date(), timeZone = getWorkflowTimeZone()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().split('T')[0];
  }

  return `${year}-${month}-${day}`;
}

export function getLocalTimestamp(date = new Date(), timeZone = getWorkflowTimeZone()): string {
  return date.toLocaleString('en-CA', { timeZone });
}

export function getRunSlug(date = new Date()): string {
  const base = process.env.CONTENT_RUN_SLUG || getLocalDateKey(date);
  const runId = process.env.GITHUB_RUN_ID || process.env.GITHUB_RUN_NUMBER;
  return sanitizeFilePart(runId ? `${base}-${runId}` : base);
}

export function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'run';
}
