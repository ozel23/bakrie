import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const directory = mkdtempSync(join(tmpdir(), 'epita-frontend-test-'));
execFileSync(
  './node_modules/.bin/tsc',
  [
    'resources/js/lib/http.ts',
    'resources/js/lib/contracts.ts',
    'resources/js/lib/types.ts',
    'resources/js/lib/time.ts',
    '--outDir',
    directory,
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
    '--target',
    'ES2022',
    '--lib',
    'ES2022,DOM,DOM.Iterable',
    '--skipLibCheck',
  ],
  { stdio: 'pipe' },
);
const require = createRequire(import.meta.url);
const { request, requestFile, ActionError, responseError } = require(join(directory, 'http.js'));
const {
  assertMutation,
  assertImport,
  assertDocument,
  isWorkspaceData,
  normalizeWorkspaceData,
} = require(join(directory, 'contracts.js'));
const { number } = require(join(directory, 'types.js'));
const { formatDate, fromLocalInput, toLocalInput, todayInZone, validTimeZone } = require(
  join(directory, 'time.js'),
);
const date = (value) => formatDate(value, 'Asia/Jakarta');
const originalFetch = globalThis.fetch;
globalThis.document = { cookie: 'XSRF-TOKEN=session%2Fcsrf', querySelector: () => null };
globalThis.window = { location: { origin: 'http://epita.test' } };
afterEach(() => {
  globalThis.fetch = originalFetch;
});
after(() => {
  rmSync(directory, { recursive: true, force: true });
  delete globalThis.document;
  delete globalThis.window;
});
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

test('JSON uses session/CSRF and returns the server acknowledgment', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/workspace/actions/report.save');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'session/csrf');
    assert.deepEqual(JSON.parse(options.body), { version: 1 });
    return json({ mutation: { uuid: 'server-id', version: 2 } });
  };
  assert.equal(
    (await request('/workspace/actions/report.save', { version: 1 })).mutation.version,
    2,
  );
});

test('multipart preserves the browser boundary and server file identity', async () => {
  const form = new FormData();
  form.append('file', new Blob(['file']), 'evidence.pdf');
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.body, form);
    assert.equal(options.headers['Content-Type'], undefined);
    return json({ uuid: 'attachment-id', checksum: 'a'.repeat(64) }, 201);
  };
  assert.equal((await request('/workspace/attachments', form)).uuid, 'attachment-id');
});

test('HTTP 200 with HTML, invalid JSON, null or arrays never becomes success', async () => {
  for (const body of ['<html>login</html>', 'invalid-json', 'null', '[]']) {
    globalThis.fetch = async () =>
      new Response(body, { status: 200, headers: { 'X-Request-ID': 'reference-1' } });
    await assert.rejects(
      request('/workspace/actions/report.save'),
      (error) => error instanceof ActionError && error.requestId === 'reference-1',
    );
  }
});

test('validation keeps nested field keys and request references', async () => {
  globalThis.fetch = async () =>
    json(
      {
        message: 'Periksa isian.',
        errors: {
          'activities.0.ends_at': ['Waktu selesai tidak valid.'],
          notes: 'Catatan terlalu panjang.',
        },
        request_id: 'json-reference',
      },
      422,
    );
  await assert.rejects(
    request('/workspace/actions/report.save', {}),
    (error) =>
      error.status === 422 &&
      error.errors['activities.0.ends_at'] === 'Waktu selesai tidak valid.' &&
      error.requestId === 'json-reference',
  );
});

test('401/403/404/409/419/429 and service errors remain failures', async () => {
  for (const status of [401, 403, 404, 409, 419, 429, 500, 502, 503]) {
    globalThis.fetch = async () =>
      json({ message: 'server-message' }, status, { 'X-Request-ID': `reference-${status}` });
    await assert.rejects(
      request('/workspace/actions/report.save', {}),
      (error) => error.status === status && error.requestId === `reference-${status}`,
    );
  }
  assert.doesNotMatch(
    responseError(500, { message: 'SQL private_field password' }).message,
    /SQL|password|private_field/,
  );
});

test('redirect to the login page is session expiry, not mutation success', async () => {
  const response = new Response('<html>Login</html>');
  Object.defineProperties(response, {
    redirected: { value: true },
    url: { value: 'http://epita.test/login' },
  });
  globalThis.fetch = async () => response;
  await assert.rejects(
    request('/workspace/import', new FormData()),
    (error) => error.status === 401,
  );
});

test('network failure stays unconfirmed without automatic business retry', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new TypeError('offline');
  };
  await assert.rejects(
    request('/workspace/actions/report.approve', {}),
    /belum dapat dikonfirmasi/,
  );
  assert.equal(calls, 1);
});

test('PDF/XLSX require the expected type and file signature', async () => {
  globalThis.fetch = async () =>
    new Response('%PDF-1.7 test', {
      headers: { 'Content-Type': 'Application/PDF; charset=binary' },
    });
  assert.ok((await requestFile('/workspace/export', {}, 'pdf')).size > 0);
  globalThis.fetch = async () =>
    new Response(new Uint8Array([0x50, 0x4b, 3, 4, 0]), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  assert.ok((await requestFile('/workspace/export', {}, 'xlsx')).size > 0);
  for (const [body, contentType] of [
    ['<html>Login</html>', 'text/html'],
    ['not-pdf', 'application/pdf'],
    ['', 'application/pdf'],
  ]) {
    globalThis.fetch = async () => new Response(body, { headers: { 'Content-Type': contentType } });
    await assert.rejects(requestFile('/workspace/export', {}, 'pdf'), ActionError);
  }
});

const emptyMetrics = () => ({
  report_counts: {},
  reports: 0,
  meter: { HM: null, KM: null, H: null },
  receipt_liters: null,
  consumption_liters: null,
  fuel_pending: 0,
  equipment_conditions: {},
  active_equipment: 0,
  trend: [],
  open_breakdowns: 0,
  active_orders: 0,
  released_orders: 0,
  orders: 0,
  breakdowns: 0,
  assignments: 0,
  assigned_equipment: 0,
  plans: 0,
  cutoff: '2026-10-23T09:00:00Z',
  start_date: null,
  end_date: null,
});
const emptyWorkspace = () => ({
  equipment: [],
  people: [],
  locations: [],
  reports: [],
  plans: [],
  assignments: [],
  breakdowns: [],
  orders: [],
  imports: [],
  metrics: emptyMetrics(),
});

test('missing snapshot/version or import identity cannot acknowledge a save', () => {
  const snapshot = {
    equipment: [],
    people: [],
    locations: [],
    reports: [],
    plans: [],
    assignments: [],
    breakdowns: [],
    orders: [],
    imports: [],
    metrics: emptyMetrics(),
  };
  assert.throws(() => assertMutation(snapshot), ActionError);
  assert.throws(
    () => assertMutation({ ...snapshot, mutation: { uuid: 'id', version: 0 } }),
    ActionError,
  );
  assert.doesNotThrow(() => assertMutation({ ...snapshot, mutation: { uuid: 'id', version: 1 } }));
  assert.throws(
    () =>
      assertMutation(
        { ...snapshot, mutation: { uuid: 'other', version: 2 } },
        { uuid: 'id', version: 1 },
      ),
    ActionError,
  );
  assert.throws(
    () =>
      assertMutation(
        { ...snapshot, mutation: { uuid: 'id', version: 1 } },
        { report_uuid: 'id', version: 1 },
      ),
    ActionError,
  );
  assert.doesNotThrow(() =>
    assertMutation(
      { ...snapshot, mutation: { uuid: 'id', version: 2 } },
      { report_uuid: 'id', version: 1 },
    ),
  );
  assert.throws(() => assertImport({ message: 'OK' }), ActionError);
  assert.doesNotThrow(() =>
    assertImport({ uuid: 'id', filename: 'source.xlsx', status: 'queued' }),
  );
});

test('unknown numeric/date values remain unavailable while confirmed zero remains zero', () => {
  assert.equal(number(null), '—');
  assert.equal(number(undefined), '—');
  assert.equal(number(''), '—');
  assert.equal(number('not-a-number'), '—');
  assert.equal(number(0), '0');
  assert.equal(date('invalid'), '—');
});

test('document preview rejects incomplete sections and accepts a valid empty result', () => {
  const empty = {
    title: 'Laporan',
    subtitle: 'Periode',
    watermark: null,
    columns: [],
    rows: [],
    sections: [],
    notes: [],
    summary: [],
  };
  assert.doesNotThrow(() => assertDocument(empty));
  assert.throws(() => assertDocument({ ...empty, sections: [{}] }), ActionError);
  assert.throws(() => assertDocument({ ...empty, rows: ['invalid'] }), ActionError);
});

test('MIME lookalikes cannot acknowledge a PDF download', async () => {
  globalThis.fetch = async () =>
    new Response('%PDF-1.7 test', { headers: { 'Content-Type': 'application/pdf-fake' } });
  await assert.rejects(requestFile('/workspace/export', {}, 'pdf'), ActionError);
});

test('incomplete metrics cannot turn into a valid empty workspace', () => {
  const value = emptyWorkspace();
  delete value.metrics.reports;
  assert.equal(isWorkspaceData(value), false);
});

test('whitespace numeric values remain unavailable', () => {
  assert.equal(number('  '), '—');
});

test('empty PHP group arrays are normalized without manufacturing absent metrics', () => {
  const raw = emptyWorkspace();
  raw.metrics.report_counts = [];
  raw.metrics.equipment_conditions = [];
  assert.equal(isWorkspaceData(normalizeWorkspaceData(raw)), true);
  delete raw.metrics.reports;
  assert.equal(isWorkspaceData(normalizeWorkspaceData(raw)), false);
  const malformed = emptyWorkspace();
  malformed.reports = [{ uuid: 'report', activities: null, fuel_events: [] }];
  assert.equal(isWorkspaceData(normalizeWorkspaceData(malformed)), false);
});

test('WIB, WITA and WIT inputs round trip to the same UTC instant including seconds', () => {
  const instant = '2026-10-23T00:00:30.000Z';
  for (const [zone, hour] of [
    ['Asia/Jakarta', '07'],
    ['Asia/Makassar', '08'],
    ['Asia/Jayapura', '09'],
  ]) {
    const local = `2026-10-23T${hour}:00:30`;
    assert.equal(toLocalInput(instant, zone), local);
    assert.equal(fromLocalInput(local, zone), instant);
  }
});

test('plant current date and sessions crossing midnight use their own zone', () => {
  const now = new Date('2026-10-22T16:30:00Z');
  assert.equal(todayInZone('Asia/Jakarta', now), '2026-10-22');
  assert.equal(todayInZone('Asia/Jayapura', now), '2026-10-23');
  const start = fromLocalInput('2026-10-23T23:30', 'Asia/Jayapura');
  const end = fromLocalInput('2026-10-24T00:30', 'Asia/Jayapura');
  assert.equal(Date.parse(end) - Date.parse(start), 3600000);
});

test('work dates remain calendar dates even when plant time is behind UTC', () => {
  assert.equal(
    formatDate('2026-10-23', 'America/New_York'),
    formatDate('2026-10-23', 'Asia/Jayapura'),
  );
  assert.notEqual(
    formatDate('2026-10-23T00:00:00Z', 'America/New_York'),
    formatDate('2026-10-23T00:00:00Z', 'Asia/Jayapura'),
  );
});

test('missing zones, invalid dates and DST ambiguity cannot silently change an instant', () => {
  assert.equal(validTimeZone(''), false);
  assert.equal(validTimeZone('not-a-zone'), false);
  assert.throws(() => fromLocalInput('2026-03-08T02:30', 'America/New_York'), RangeError);
  assert.throws(() => fromLocalInput('2026-11-01T01:30', 'America/New_York'), RangeError);
  assert.throws(() => fromLocalInput('2026-02-30T10:00', 'Asia/Makassar'), RangeError);
});
