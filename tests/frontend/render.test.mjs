import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const vite = await createServer({
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: 'custom',
});
after(() => vite.close());
const load = async (path) => vite.ssrLoadModule(`/resources/js/${path}`);
const UI = await load('components/UI.tsx');
const { WorkspaceProvider } = await load('lib/workspace.tsx');
const { default: Planning } = await load('components/Planning.tsx');
const { default: Login } = await load('pages/Login.tsx');
const { ReportEditor } = await load('components/Reports.tsx');
const { default: RecordForm } = await load('components/RecordForm.tsx');
const { default: Workspace } = await load('pages/Workspace.tsx');
const { default: Dashboard } = await load('components/Dashboard.tsx');
const data = {
  equipment: [],
  people: [],
  locations: [],
  reports: [],
  plans: [],
  assignments: [],
  breakdowns: [],
  orders: [],
  imports: [],
  metrics: {
    report_counts: {},
    reports: 0,
    meter: { HM: 0, KM: 0, H: null },
    receipt_liters: 0,
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
    assignments: 105,
    assigned_equipment: 0,
    plans: 0,
    cutoff: '2026-10-23T09:00:00+07:00',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
  },
  pagination: Object.fromEntries(
    [
      'reports',
      'assignments',
      'equipment',
      'people',
      'locations',
      'orders',
      'breakdowns',
      'imports',
      'plans',
      'fuel',
    ].map((resource) => [
      resource,
      { total: 0, current_page: 1, last_page: 1, per_page: 8, from: null, to: null },
    ]),
  ),
};
const props = {
  page: 'dashboard',
  snapshot: data,
  filters: { period: '2026-10' },
  permissions: [],
  auth: {
    name: 'Fixture pengujian',
    email: 'fixture@example.invalid',
    role_label: 'Pengujian terisolasi',
  },
  plant: { uuid: 'fixture-plant', timezone: 'Asia/Jakarta', code: 'TEST', name: 'Plant pengujian' },
  plants: [],
};
const wrap = (child, override = {}) =>
  createElement(WorkspaceProvider, { props: { ...props, ...override }, onNotify: () => {} }, child);
const renderPage = async (Component, pageProps = {}) =>
  createInertiaApp({
    page: {
      component: 'UnderTest',
      props: pageProps,
      url: '/test-isolated',
      version: null,
      clearHistory: false,
      encryptHistory: false,
    },
    resolve: () => Component,
    render: renderToString,
    setup: ({ App, props }) => createElement(App, props),
  });
const output = process.env.EPITA_FRONTEND_QA_OUTPUT;
if (output) mkdirSync(output, { recursive: true });
const save = (name, html) => {
  if (!output) return;
  const manifest = JSON.parse(readFileSync('public/build/manifest.json', 'utf8'));
  const css = (manifest['resources/js/app.tsx'].css ?? [])
    .map((file) => readFileSync(join('public/build', file), 'utf8'))
    .join('\n');
  writeFileSync(
    join(output, `${name}.html`),
    `<!doctype html><html lang="id"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'"><title>Pengujian frontend terisolasi</title><style>${css}</style><body>${html}</body></html>`,
  );
};

test('field validation is associated with its control for assistive technology', () => {
  const html = renderToString(
    createElement(UI.Field, { label: 'Kode', error: 'Kode wajib diisi.' }, createElement('input')),
  );
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby=/);
  assert.match(html, /role="alert"/);
});

test('nested dialogs have unique labels', () => {
  const html = renderToString(
    createElement(
      UI.Modal,
      { title: 'Detail', onClose: () => {} },
      createElement(UI.Modal, { title: 'Verifikasi', onClose: () => {} }, 'Form'),
    ),
  );
  const labels = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(labels.length, 2);
  assert.equal(new Set(labels).size, 2);
});

test('server table does not turn the current page into a fabricated total', () => {
  const html = renderToString(
    wrap(
      createElement(UI.DataTable, {
        rows: [{ uuid: 'row' }],
        resource: 'reports',
        keyOf: (row) => row.uuid,
        columns: [{ label: 'Kode', render: (row) => row.uuid }],
      }),
      { snapshot: { ...data, pagination: undefined } },
    ),
  );
  assert.match(html, /total belum tersedia/);
  assert.doesNotMatch(html, /Halaman berikutnya/);
});

test('planning summaries use the complete server count with an empty page', () => {
  const html = renderToString(wrap(createElement(Planning)));
  assert.match(html, /105/);
  assert.doesNotMatch(html, /Rencana baru|Buat penugasan/);
});

test('login renders without synthetic access or browser accounts', async () => {
  const page = await renderPage(Login);
  assert.match(page.body, /Gunakan akun yang terdaftar/);
  assert.doesNotMatch(page.body, /demo|dummy|prototype|Masuk tanpa|@demo/i);
  save('login', page.body);
});

test('all workspace modules render with empty server results and no made-up rows', async () => {
  for (const page of [
    'planning',
    'reports',
    'approvals',
    'fuel',
    'maintenance',
    'exports',
    'integrations',
    'equipment',
    'people',
    'locations',
  ]) {
    const rendered = await renderPage(Workspace, { ...props, page });
    assert.doesNotMatch(rendered.body, /\b(?:demo|dummy|prototype|NaN)\b|Invalid Date/i);
    assert.match(rendered.body, /main-content/);
    save(page, rendered.body);
  }
});

test('forms retain the existing grouping and render within the isolated context', () => {
  save('report-form', renderToString(wrap(createElement(ReportEditor, { onClose: () => {} }))));
  for (const kind of [
    'equipment',
    'person',
    'location',
    'plan',
    'assignment',
    'breakdown',
    'order',
    'action',
    'release',
  ]) {
    const html = renderToString(wrap(createElement(RecordForm, { kind, onClose: () => {} })));
    assert.match(html, /role="dialog"/);
    save(`form-${kind}`, html);
  }
});

test('dashboard distinguishes unknown consumption from confirmed zeros', async () => {
  const Component = () =>
    wrap(
      createElement(Dashboard, {
        base: '/app',
        onNewReport: () => {},
        onReport: () => {},
        onBreakdown: () => {},
      }),
    );
  const rendered = await renderPage(Component);
  assert.match(rendered.body, /—/);
  assert.doesNotMatch(rendered.body, /\b(?:NaN|demo|dummy)\b/i);
  save('dashboard', rendered.body);
});

test('server empty group arrays render as a valid empty workspace', async () => {
  const snapshot = structuredClone(data);
  snapshot.metrics.report_counts = [];
  snapshot.metrics.equipment_conditions = [];
  const rendered = await renderPage(Workspace, { ...props, page: 'reports', snapshot });
  assert.match(rendered.body, /main-content/);
});

test('missing plant timezone cannot silently default the workspace to WIB', async () => {
  const plant = { ...props.plant };
  delete plant.timezone;
  const rendered = await renderPage(Workspace, { ...props, plant });
  assert.match(rendered.body, /Data halaman belum dapat dimuat/);
  assert.doesNotMatch(rendered.body, /id="main-content"/);
});

test('assignment forms expose the configured plant timezone', () => {
  for (const [timezone, label] of [
    ['Asia/Jakarta', 'WIB'],
    ['Asia/Makassar', 'WITA'],
    ['Asia/Jayapura', 'WIT'],
  ]) {
    const html = renderToString(
      wrap(createElement(RecordForm, { kind: 'assignment', onClose: () => {} }), {
        plant: { ...props.plant, timezone },
      }),
    );
    assert.match(html, new RegExp(`Mulai \\(${label}\\)`));
  }
});
