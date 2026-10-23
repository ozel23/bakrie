export function retryDelay(attempt, random = Math.random) {
  return Math.min(300000, 1000 * 2 ** Math.min(Math.max(attempt, 0), 8)) * (0.75 + random() * 0.5);
}
export function failureState(status) {
  if (status === 401) return 'auth_required';
  if (status === 403) return 'blocked';
  if (status === 409) return 'conflict';
  if (status === 422) return 'invalid';
  return 'queued';
}
export function canAccessOffline(until, now = Date.now()) {
  return Number.isFinite(Date.parse(until)) && Date.parse(until) > now;
}
