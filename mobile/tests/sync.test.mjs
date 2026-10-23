import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay, failureState, canAccessOffline } from '../src/retry.mjs';
test('only transient failures are automatically retried', () => {
  assert.equal(failureState(401), 'auth_required');
  assert.equal(failureState(403), 'blocked');
  assert.equal(failureState(409), 'conflict');
  assert.equal(failureState(422), 'invalid');
  assert.equal(failureState(503), 'queued');
});
test('retry increases and is bounded with jitter', () => {
  assert.ok(retryDelay(5, () => 0.5) > retryDelay(1, () => 0.5));
  assert.ok(retryDelay(999, () => 0.5) <= 300000);
});
test('expired offline leases cannot reopen cached workspaces', () => {
  assert.equal(canAccessOffline('2026-10-01T00:00:00Z', Date.parse('2026-10-02T00:00:00Z')), false);
  assert.equal(canAccessOffline('2026-10-03T00:00:00Z', Date.parse('2026-10-02T00:00:00Z')), true);
  assert.equal(canAccessOffline('invalid'), false);
});
