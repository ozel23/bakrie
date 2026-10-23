import type { WorkspaceData } from './types';
import { ActionError, isRecord } from './http';

export function normalizeWorkspaceData(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.metrics)) return value;
  const metrics = { ...value.metrics };
  for (const key of ['report_counts', 'equipment_conditions']) {
    if (Array.isArray(metrics[key]) && metrics[key].length === 0) metrics[key] = {};
  }
  return { ...value, metrics };
}

export function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!isRecord(value) || !isRecord(value.metrics)) return false;
  const lists = [
    'equipment',
    'people',
    'locations',
    'reports',
    'plans',
    'assignments',
    'breakdowns',
    'orders',
    'imports',
  ];
  const records = (rows: unknown): rows is Record<string, unknown>[] =>
    Array.isArray(rows) &&
    rows.every((row) => isRecord(row) && typeof row.uuid === 'string' && !!row.uuid);
  if (!lists.every((key) => records(value[key]))) return false;
  const metrics = value.metrics;
  const count = (number: unknown) =>
    typeof number === 'number' && Number.isInteger(number) && number >= 0;
  const buckets = (map: unknown) => isRecord(map) && Object.values(map).every(count);
  const decimal = (number: unknown) =>
    number === null ||
    ((typeof number === 'number' || (typeof number === 'string' && !!number.trim())) &&
      Number.isFinite(Number(number)));
  const counts = [
    'reports',
    'fuel_pending',
    'active_equipment',
    'open_breakdowns',
    'active_orders',
    'released_orders',
    'orders',
    'breakdowns',
    'assignments',
    'assigned_equipment',
    'plans',
  ];
  if (
    !counts.every((key) => count(metrics[key])) ||
    !buckets(metrics.report_counts) ||
    !buckets(metrics.equipment_conditions) ||
    !isRecord(metrics.meter) ||
    !['HM', 'KM', 'H'].every((unit) => decimal((metrics.meter as Record<string, unknown>)[unit])) ||
    !decimal(metrics.receipt_liters) ||
    !decimal(metrics.consumption_liters) ||
    typeof metrics.cutoff !== 'string' ||
    !Number.isFinite(Date.parse(metrics.cutoff)) ||
    !Array.isArray(metrics.trend) ||
    !metrics.trend.every(
      (row) =>
        isRecord(row) &&
        typeof row.date === 'string' &&
        typeof row.unit === 'string' &&
        decimal(row.total),
    )
  )
    return false;
  for (const key of ['equipment', 'people', 'locations']) {
    if (
      !(value[key] as Record<string, unknown>[]).every(
        (row) => typeof row.name === 'string' && typeof row.code === 'string',
      )
    )
      return false;
  }
  if (
    !(value.reports as Record<string, unknown>[]).every(
      (report) =>
        ['activities', 'fuel_events', 'helpers', 'history'].every(
          (key) => Array.isArray(report[key]) && report[key].every(isRecord),
        ) &&
        (report.attachments === undefined || Array.isArray(report.attachments)),
    )
  )
    return false;
  if (
    !(value.plans as Record<string, unknown>[]).every(
      (plan) => Array.isArray(plan.items) && plan.items.every(isRecord),
    )
  )
    return false;
  if (
    !(value.orders as Record<string, unknown>[]).every(
      (order) =>
        Array.isArray(order.actions) &&
        order.actions.every((action) => isRecord(action) && Array.isArray(action.parts)),
    )
  )
    return false;
  return true;
}

export function assertMutation(
  value: unknown,
  input?: unknown,
): asserts value is WorkspaceData & { mutation: { uuid: string; version: number } } {
  if (
    !isWorkspaceData(value) ||
    !isRecord(value.mutation) ||
    typeof value.mutation.uuid !== 'string' ||
    !value.mutation.uuid ||
    !Number.isInteger(value.mutation.version) ||
    Number(value.mutation.version) < 1
  ) {
    throw new ActionError(
      'Hasil penyimpanan belum dapat dikonfirmasi. Periksa data terbaru sebelum mencoba kembali.',
    );
  }
  const identity = isRecord(input) ? (input.uuid ?? input.report_uuid) : undefined;
  const previousVersion = isRecord(input) ? input.version : undefined;
  if (
    (typeof identity === 'string' && identity && value.mutation.uuid !== identity) ||
    (typeof previousVersion === 'number' && value.mutation.version <= previousVersion)
  ) {
    throw new ActionError(
      'Identitas atau versi hasil penyimpanan belum dapat dikonfirmasi. Periksa data terbaru sebelum mencoba kembali.',
    );
  }
}

export function assertImport(value: unknown): asserts value is WorkspaceData['imports'][number] {
  if (
    !isRecord(value) ||
    typeof value.uuid !== 'string' ||
    !value.uuid ||
    typeof value.status !== 'string' ||
    typeof value.filename !== 'string'
  ) {
    throw new ActionError(
      'Status unggahan belum dapat dikonfirmasi. Periksa daftar impor sebelum mengunggah ulang.',
    );
  }
}

export function assertDocument(value: unknown): void {
  const table = (candidate: unknown): boolean =>
    isRecord(candidate) &&
    Array.isArray(candidate.columns) &&
    candidate.columns.every((column) => typeof column === 'string') &&
    Array.isArray(candidate.rows) &&
    candidate.rows.every(
      (row) =>
        Array.isArray(row) &&
        row.every((cell) => cell === null || typeof cell === 'string' || typeof cell === 'number'),
    );
  if (
    !isRecord(value) ||
    !table(value) ||
    typeof value.title !== 'string' ||
    typeof value.subtitle !== 'string' ||
    !(value.watermark === null || typeof value.watermark === 'string') ||
    !Array.isArray(value.sections) ||
    !value.sections.every(
      (section) => table(section) && isRecord(section) && typeof section.title === 'string',
    ) ||
    !Array.isArray(value.notes) ||
    !value.notes.every((note) => typeof note === 'string') ||
    !Array.isArray(value.summary) ||
    !value.summary.every((summary) => typeof summary === 'string')
  ) {
    throw new ActionError('Pratinjau belum dapat dimuat. Silakan coba lagi.');
  }
}
