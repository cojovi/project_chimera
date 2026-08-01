export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function remainingUntil(target: Date, nowMs: number): Remaining {
  const totalMs = Math.max(0, target.getTime() - nowMs);
  const s = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    totalMs
  };
}

export function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatInterval(minutes: number): string {
  if (minutes % 525600 === 0 && minutes >= 525600) return `${minutes / 525600} YR`;
  if (minutes % 43200 === 0 && minutes >= 43200) return `${minutes / 43200} MO`;
  if (minutes % 10080 === 0 && minutes >= 10080) return `${minutes / 10080} WK`;
  if (minutes % 1440 === 0 && minutes >= 1440) return `${minutes / 1440} DAY${minutes / 1440 > 1 ? 'S' : ''}`;
  if (minutes % 60 === 0 && minutes >= 60) return `${minutes / 60} HR`;
  return `${minutes} MIN`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d
    .toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    .toUpperCase();
}
