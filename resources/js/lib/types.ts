export type Condition = 'working' | 'standby' | 'breakdown' | 'maintenance' | 'unknown';
export type ReportStatus = 'draft' | 'submitted' | 'reviewed' | 'returned' | 'approved';
export type Category = 'heavy_equipment' | 'vehicle' | 'engine' | 'genset';
export type Equipment = {
  uuid: string;
  code: string;
  name: string;
  category: Category;
  model?: string;
  plate?: string;
  ownership: string;
  meter_unit: string;
  last_meter: string | null;
  condition: Condition;
  condition_at: string | null;
  active: boolean;
  version: number;
};
export type Person = {
  uuid: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
  version: number;
};
export type Location = {
  uuid: string;
  code: string;
  name: string;
  type: string;
  sap_code?: string;
  parent_uuid?: string | null;
  active: boolean;
  version: number;
};
export type Activity = {
  uuid?: string;
  starts_at: string;
  ends_at: string;
  break_seconds: number;
  description: string;
  location_uuid: string;
  plan_item_uuid?: string;
  work_code?: string;
  quantity: string;
  unit: string;
  origin?: string;
  destination?: string;
  cargo?: string;
  meter_start?: string;
  meter_end?: string;
  sap_order?: string;
  sap_operation?: string;
};
export type Fuel = {
  uuid: string;
  meaning: 'unverified' | 'receipt' | 'consumption';
  quantity: string;
  unit: string;
  fuel_type: string;
  method: string;
  place: string;
  verified_at?: string | null;
  verification_reason?: string;
};
export type Report = {
  uuid: string;
  equipment_uuid: string;
  operator_uuid: string;
  work_date: string;
  shift: string;
  version: number;
  status: ReportStatus;
  condition: Condition;
  meter_start: string;
  meter_end: string;
  meter_delta: string | null;
  meter_unit: string;
  work_seconds: number;
  notes: string;
  exception_reason?: string;
  activities: Activity[];
  fuel_events: Fuel[];
  helpers: { person_uuid: string; overtime_minutes: number }[];
  overtime_minutes: number;
  history: { status: string; at: string; actor: string; reason?: string; version: number }[];
  attachments?: { uuid: string; name: string; url?: string; local?: boolean }[];
};
export type Plan = {
  uuid: string;
  title: string;
  starts_on: string;
  ends_on: string;
  status: string;
  notes: string;
  items: {
    uuid: string;
    location_uuid: string;
    work_code: string;
    description: string;
    target: string;
    unit: string;
    actual?: string | null;
  }[];
};
export type Assignment = {
  uuid: string;
  equipment_uuid: string;
  operator_uuid: string;
  plan_item_uuid?: string;
  starts_at: string;
  ends_at: string;
  status: string;
  reason: string;
  version: number;
};
export type Breakdown = {
  uuid: string;
  equipment_uuid: string;
  occurred_at: string;
  description: string;
  severity: string;
  status: string;
};
export type MaintenanceAction = {
  uuid: string;
  technician_uuid: string;
  starts_at: string;
  ends_at: string;
  description: string;
  result: string;
  parts: {
    code: string;
    name: string;
    quantity: string;
    unit: string;
    warehouse_reference?: string;
  }[];
};
export type MaintenanceOrder = {
  uuid: string;
  equipment_uuid: string;
  breakdown_uuid?: string;
  type: string;
  diagnosis: string;
  starts_at: string;
  status: string;
  version: number;
  released_at?: string;
  actions: MaintenanceAction[];
  release_checklist?: { functional_test: boolean; safety_check: boolean; notes: string };
};
export type ImportBatch = {
  uuid: string;
  filename: string;
  kind: string;
  status: string;
  created_at: string;
  rows_count: number;
  error?: string;
  rows?: {
    sheet: string;
    row_number: number;
    classification: string;
    issues: string[];
    normalized: Record<string, unknown>;
    raw_payload: Record<string, unknown>;
  }[];
};
export type Pagination = {
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  from: number | null;
  to: number | null;
};
export type Metrics = {
  report_counts: Record<string, number>;
  reports: number;
  meter: Record<string, string | number | null>;
  receipt_liters: string | number | null;
  consumption_liters: string | number | null;
  fuel_pending: number;
  equipment_conditions: Record<string, number>;
  active_equipment: number;
  trend: { date: string; unit: string; total: string | number | null }[];
  open_breakdowns: number;
  active_orders: number;
  released_orders: number;
  orders: number;
  breakdowns: number;
  assignments: number;
  assigned_equipment: number;
  plans: number;
  cutoff: string;
  start_date: string | null;
  end_date: string | null;
};
export type WorkspaceData = {
  equipment: Equipment[];
  people: Person[];
  locations: Location[];
  reports: Report[];
  plans: Plan[];
  assignments: Assignment[];
  breakdowns: Breakdown[];
  orders: MaintenanceOrder[];
  imports: ImportBatch[];
  metrics: Metrics;
  fuel_page_uuids?: string[];
  mutation?: { uuid: string; version: number };
  pagination?: Record<string, Pagination>;
  catalog_rows?: { equipment?: Equipment[]; people?: Person[]; locations?: Location[] };
};
export type WorkspaceProps = {
  page: string;
  snapshot: WorkspaceData;
  filters?: Record<string, string>;
  auth?: {
    name: string;
    email: string;
    role?: string;
    role_label?: string;
    person_uuid?: string | null;
  };
  plants?: { uuid: string; name: string; code: string; timezone: string }[];
  plant?: { uuid: string; name: string; code: string; timezone: string };
  permissions?: string[];
  error?: string;
};
export const labels: Record<string, string> = {
  working: 'Bekerja',
  standby: 'Standby',
  breakdown: 'Breakdown',
  maintenance: 'Perawatan',
  unknown: 'Belum dikonfirmasi',
  draft: 'Draft',
  submitted: 'Menunggu pemeriksaan',
  reviewed: 'Sedang diperiksa',
  returned: 'Perlu revisi',
  approved: 'Disetujui',
  heavy_equipment: 'Alat berat',
  vehicle: 'Kendaraan',
  engine: 'Mesin pabrik',
  genset: 'Genset',
  unverified: 'Perlu verifikasi',
  receipt: 'Pengisian',
  consumption: 'Konsumsi',
  open: 'Terbuka',
  in_progress: 'Dikerjakan',
  released: 'Dirilis',
  closed: 'Selesai',
  assigned: 'Ditugaskan',
  accepted: 'Diterima',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  corrective: 'Corrective',
  preventive: 'Preventive',
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
  critical: 'Kritis',
  OWN: 'Milik sendiri',
  RENT: 'Sewa',
  LEND: 'LEND · perlu konfirmasi',
  operator: 'Operator',
  driver: 'Sopir',
  helper: 'Helper',
  technician: 'Teknisi',
  direct: 'Diukur langsung',
  stock_balance: 'Neraca stok',
  estimate: 'Estimasi',
  queued: 'Dalam antrean',
  processing: 'Sedang diproses',
  staged: 'Staging · perlu diperiksa',
  failed: 'Gagal',
  processed: 'Selesai',
};
export const number = (value: string | number | null | undefined, max = 2) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && !value.trim()) ||
  !Number.isFinite(Number(value))
    ? '—'
    : new Intl.NumberFormat('id-ID', { maximumFractionDigits: max }).format(Number(value));
export const uid = () => crypto.randomUUID();
