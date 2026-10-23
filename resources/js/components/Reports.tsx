import { usePlantTime } from '../lib/usePlantTime';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Droplets,
  FileCheck2,
  FilePlus2,
  FileText,
  HardHat,
  History,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  ActionError,
  useUnsavedChanges,
  request,
  useServerSearch,
  useWorkspace,
} from '../lib/workspace';
import {
  type Activity,
  type Fuel,
  type Report,
  type ReportStatus,
  labels,
  number,
  uid,
} from '../lib/types';
import {
  Badge,
  Button,
  CheckItem,
  DataTable,
  Empty,
  ErrorNotice,
  Field,
  Modal,
  PageTitle,
  Panel,
  SearchInput,
  Select,
} from './UI';
export function ReportsPage({
  approval = false,
  onOpen,
  onNew,
}: {
  approval?: boolean;
  onOpen: (r: Report) => void;
  onNew: () => void;
}) {
  const { date, shortDate } = usePlantTime();
  const { data, period, permissions, filters, filter } = useWorkspace();
  const [search, setSearch] = useServerSearch();
  const status = filters.status || (approval ? 'pending' : 'all');
  const setStatus = (status: string) => filter({ status, reports_page: 1 });
  const statuses = approval
    ? [
        ['pending', 'Antrean pemeriksaan'],
        ['returned', 'Dikembalikan'],
        ['approved', 'Disetujui'],
      ]
    : [
        ['all', 'Semua laporan'],
        ['draft', 'Draft'],
        ['submitted', 'Dikirim'],
        ['reviewed', 'Diperiksa'],
        ['returned', 'Perlu revisi'],
        ['approved', 'Disetujui'],
      ];
  const base = data.reports;
  const filtered = base;
  const counts = data.metrics.report_counts;

  return (
    <>
      <PageTitle
        eyebrow={approval ? 'OPERASIONAL / VERIFIKASI' : 'OPERASIONAL / PENCATATAN'}
        title={approval ? 'Persetujuan laporan' : 'Laporan harian'}
        description={
          approval
            ? 'Periksa aktivitas, kontinuitas meter, bukti, dan makna BBM sebelum persetujuan.'
            : 'Catatan aktivitas alat dan personel yang dapat ditelusuri per tanggal dan shift.'
        }
        actions={
          !approval &&
          permissions.some((p) => ['report-own', 'report-delegate'].includes(p)) && (
            <Button kind="primary" onClick={onNew}>
              <Plus size={17} />
              Laporan baru
            </Button>
          )
        }
      />
      {approval && (
        <div className="info-banner">
          <ShieldCheck size={20} />
          <div>
            <strong>Keputusan yang bisa ditelusuri</strong>
            <span>
              Persetujuan menyimpan versi, identitas pemeriksa, waktu, dan histori. Pembuat tidak
              dapat menyetujui laporannya sendiri.
            </span>
          </div>
        </div>
      )}
      <Panel>
        <div className="tabs table-tabs">
          {statuses.map(([key, label]) => (
            <button
              key={key}
              className={status === key ? 'active' : ''}
              onClick={() => setStatus(key)}
            >
              {label}
              <span>
                {key === 'all'
                  ? data.metrics.reports
                  : key === 'pending'
                    ? (counts.submitted ?? 0) + (counts.reviewed ?? 0)
                    : (counts[key] ?? 0)}
              </span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari alat, operator, atau uraian kegiatan…"
          />
          <span className="table-count">
            Periode {date(`${period}-01`, { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <DataTable
          rows={filtered}
          resource="reports"
          keyOf={(r) => r.uuid}
          onRow={onOpen}
          emptyTitle={
            approval ? 'Tidak ada laporan pada antrean ini' : 'Belum ada laporan pada filter ini'
          }
          emptyText="Sesuaikan periode atau status untuk melihat catatan lainnya."
          columns={[
            {
              label: 'Equipment / operator',
              render: (r) => {
                const e = data.equipment.find((e) => e.uuid === r.equipment_uuid);
                return (
                  <div className="cell-identity">
                    <span
                      className={`equipment-avatar ${e?.category === 'vehicle' ? 'vehicle' : ''}`}
                    >
                      {e?.category === 'vehicle' ? <Truck size={19} /> : <HardHat size={19} />}
                    </span>
                    <span>
                      <strong>{e?.name ?? '—'}</strong>
                      <small>
                        {data.people.find((p) => p.uuid === r.operator_uuid)?.name ?? '—'}
                      </small>
                    </span>
                  </div>
                );
              },
            },
            {
              label: 'Tanggal / shift',
              render: (r) => (
                <div className="cell-stack">
                  <strong>{shortDate(r.work_date)}</strong>
                  <small className="capitalize">
                    {r.shift} · v{r.version}
                  </small>
                </div>
              ),
            },
            {
              label: 'Aktivitas',
              render: (r) => (
                <div className="cell-stack cell-description">
                  <span>{r.activities[0]?.description ?? 'Belum dilengkapi'}</span>
                  <small>{r.activities.length} sesi / perjalanan</small>
                </div>
              ),
            },
            {
              label: 'Prestasi',
              render: (r) => (
                <span className="meter-value">
                  {number(r.meter_delta)} <small>{r.meter_unit}</small>
                </span>
              ),
            },
            { label: 'Status', render: (r) => <Badge value={r.status} /> },
            {
              label: '',
              render: (r) => (
                <button
                  className="icon-button"
                  aria-label={`Buka laporan ${shortDate(r.work_date)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r);
                  }}
                >
                  <ChevronRight size={17} />
                </button>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
export function ReportEditor({ report, onClose }: { report?: Report; onClose: () => void }) {
  const { today, shortDate, iso, toLocal, zoneLabel } = usePlantTime();
  const { data, run, notify, personUuid, permissions } = useWorkspace();
  const ownOnly = permissions.includes('report-own') && !permissions.includes('report-delegate');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const initial: Report = report
    ? structuredClone(report)
    : {
        uuid: uid(),
        equipment_uuid: '',
        operator_uuid: personUuid ?? '',
        work_date: today(),
        shift: 'utama',
        version: 0,
        status: 'draft',
        condition: 'working',
        meter_start: '',
        meter_end: '',
        meter_delta: null,
        meter_unit: 'HM',
        work_seconds: 0,
        notes: '',
        activities: [],
        fuel_events: [],
        helpers: [],
        overtime_minutes: 0,
        history: [],
        attachments: [],
      };
  const [form, setForm] = useState<Report>(initial);
  const [timeInputs, setTimeInputs] = useState<Record<string, { value: string; message: string }>>(
    {},
  );
  const set = <K extends keyof Report>(key: K, value: Report[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const equipment = data.equipment.find((e) => e.uuid === form.equipment_uuid);
  const [files, setFiles] = useState<File[]>([]);
  const attachmentIds = useRef(new Map<File, string>());
  const mayClose = useUnsavedChanges(
    { form, timeInputs, files: files.map((file) => [file.name, file.size]) },
    busy,
  );
  const fieldErrors = {
    ...(error instanceof ActionError ? error.errors : {}),
    ...Object.fromEntries(Object.entries(timeInputs).map(([key, input]) => [key, input.message])),
  };
  const delta =
    form.meter_start !== '' && form.meter_end !== ''
      ? Number(form.meter_end) - Number(form.meter_start)
      : null;
  const updateActivity = (index: number, key: keyof Activity, value: string | number) =>
    set(
      'activities',
      form.activities.map((a, i) => (i === index ? { ...a, [key]: value } : a)),
    );
  const updateActivityTime = (index: number, key: 'starts_at' | 'ends_at', value: string) => {
    const field = `activities.${index}.${key}`;
    try {
      updateActivity(index, key, value ? iso(value) : '');
      setTimeInputs((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Waktu belum dapat dibaca.';
      setTimeInputs((current) => ({ ...current, [field]: { value, message } }));
    }
  };
  const removeActivity = (index: number) => {
    set(
      'activities',
      form.activities.filter((_, row) => row !== index),
    );
    setTimeInputs((current) =>
      Object.fromEntries(
        Object.entries(current).flatMap(([field, input]) => {
          const [, row, key] = field.split('.');
          if (Number(row) === index) return [];
          return [[`activities.${Number(row) > index ? Number(row) - 1 : row}.${key}`, input]];
        }),
      ),
    );
  };
  const addActivity = () => {
    try {
      set('activities', [
        ...form.activities,
        {
          starts_at: iso(`${form.work_date}T07:00`),
          ends_at: iso(`${form.work_date}T16:00`),
          break_seconds: 3600,
          description: '',
          location_uuid: '',
          quantity: '',
          unit: '',
          work_code: '',
        },
      ]);
    } catch (error) {
      setError(error);
    }
  };
  const updateFuel = (index: number, key: keyof Fuel, value: string) =>
    set(
      'fuel_events',
      form.fuel_events.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    );
  const duration = form.activities.reduce(
    (sum, a) =>
      sum +
      Math.max(
        0,
        (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 1000 - a.break_seconds,
      ),
    0,
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (Object.keys(timeInputs).length) {
      setStep(1);
      setError(new ActionError('Periksa waktu aktivitas yang belum valid.', fieldErrors));
      return;
    }
    setBusy(true);
    setError(null);
    let draftSaved = false;
    try {
      if (!form.equipment_uuid || !form.operator_uuid)
        throw new Error('Pilih equipment dan operator terlebih dahulu.');
      const {
        uuid,
        equipment_uuid,
        operator_uuid,
        work_date,
        shift,
        version,
        condition,
        meter_start,
        meter_end,
        notes,
        exception_reason,
        activities,
        fuel_events,
        helpers,
        overtime_minutes,
      } = form;
      const saved = await run('report.save', {
        uuid,
        equipment_uuid,
        operator_uuid,
        work_date,
        shift,
        version,
        condition,
        meter_start: meter_start === '' ? null : meter_start,
        meter_end: meter_end === '' ? null : meter_end,
        notes,
        exception_reason,
        activities,
        fuel_events,
        helpers,
        overtime_minutes,
      });
      draftSaved = true;
      if (saved.mutation) setForm((current) => ({ ...current, version: saved.mutation!.version }));
      if (files.length) {
        for (const file of files) {
          const body = new FormData();
          body.append('report_uuid', form.uuid);
          const attachmentUuid = attachmentIds.current.get(file) ?? uid();
          attachmentIds.current.set(file, attachmentUuid);
          body.append('attachment_uuid', attachmentUuid);
          body.append('file', file);
          const attachment = await request<{ uuid: string; checksum: string }>(
            '/workspace/attachments',
            body,
          );
          if (attachment.uuid !== attachmentUuid || !/^[a-f0-9]{64}$/.test(attachment.checksum)) {
            throw new ActionError('Unggahan bukti belum dapat dikonfirmasi.');
          }
          setFiles((current) => current.filter((pending) => pending !== file));
          setForm((current) => ({
            ...current,
            attachments: [
              ...(current.attachments ?? []),
              { uuid: attachment.uuid, name: file.name, url: `/attachments/${attachment.uuid}` },
            ],
          }));
        }
      }
      notify('Draft tersimpan di server.');
      onClose();
    } catch (err) {
      if (draftSaved) setStep(2);
      else if (err instanceof ActionError) {
        const fields = Object.keys(err.errors);
        if (fields.some((field) => field.startsWith('activities'))) setStep(1);
        else if (fields.some((field) => field.startsWith('fuel_events') || field === 'file'))
          setStep(2);
        else if (fields.length) setStep(0);
      }

      setError(
        draftSaved
          ? new ActionError(
              `Draft sudah tersimpan. Bukti yang belum selesai tetap tersedia untuk dicoba kembali. ${err instanceof Error ? err.message : ''}`,
              err instanceof ActionError ? err.errors : {},
              err instanceof ActionError ? err.status : 0,
              err instanceof ActionError ? err.requestId : undefined,
            )
          : err,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={report ? 'Revisi laporan harian' : 'Laporan harian baru'}
      description={'Simpan draft terlebih dahulu, lalu kirim melalui detail laporan.'}
      onClose={() => {
        if (mayClose()) onClose();
      }}
      wide
    >
      <form onSubmit={save}>
        <div className="form-steps">
          {[
            ['Identitas & meter', FileText],
            ['Aktivitas', Clock3],
            ['BBM & bukti', Droplets],
            ['Ringkasan', CheckCheck],
          ].map(([label, Icon], i) => {
            const I = Icon as typeof FileText;
            return (
              <button
                key={i}
                type="button"
                className={step === i ? 'active' : step > i ? 'complete' : ''}
                onClick={() => setStep(i)}
              >
                <span>{step > i ? <Check size={14} /> : i + 1}</span>
                {label as string}
              </button>
            );
          })}
        </div>
        <ErrorNotice error={error} />
        {step === 0 && (
          <div className="form-grid">
            <Field label="Tanggal kerja" error={fieldErrors.work_date}>
              <input
                required
                type="date"
                value={form.work_date}
                onChange={(e) => set('work_date', e.target.value)}
              />
            </Field>
            <Field label="Shift" error={fieldErrors.shift}>
              <Select value={form.shift} onChange={(e) => set('shift', e.target.value)}>
                {['utama', 'pagi', 'sore', 'malam'].map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Equipment" error={fieldErrors.equipment_uuid}>
              <Select
                required
                disabled={form.version > 0}
                value={form.equipment_uuid}
                onChange={(e) => {
                  const eq = data.equipment.find((x) => x.uuid === e.target.value);
                  setForm((f) => ({
                    ...f,
                    equipment_uuid: e.target.value,
                    meter_unit: eq?.meter_unit ?? 'HM',
                    meter_start: eq?.last_meter ?? '',
                  }));
                }}
              >
                <option value="">Pilih equipment</option>
                {data.equipment
                  .filter((e) => e.active)
                  .map((e) => (
                    <option key={e.uuid} value={e.uuid}>
                      {e.code} · {e.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Operator / sopir" error={fieldErrors.operator_uuid}>
              <Select
                required
                disabled={ownOnly && !!personUuid}
                value={form.operator_uuid}
                onChange={(e) => set('operator_uuid', e.target.value)}
              >
                <option value="">Pilih operator</option>
                {data.people
                  .filter(
                    (p) =>
                      p.active &&
                      ['operator', 'driver'].includes(p.type) &&
                      (!ownOnly || !personUuid || p.uuid === personUuid),
                  )
                  .map((p) => (
                    <option key={p.uuid} value={p.uuid}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="meter-fields span-2">
              <Field
                label={`Meter awal (${equipment?.meter_unit ?? 'HM'})`}
                error={fieldErrors.meter_start}
              >
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.meter_start}
                  onChange={(e) => set('meter_start', e.target.value)}
                />
              </Field>
              <ArrowRight size={20} />
              <Field
                label={`Meter akhir (${equipment?.meter_unit ?? 'HM'})`}
                error={
                  fieldErrors.meter_end ??
                  (delta !== null && delta < 0 ? 'Meter akhir lebih kecil dari awal.' : undefined)
                }
              >
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.meter_end}
                  onChange={(e) => set('meter_end', e.target.value)}
                />
              </Field>
              <div className={`meter-preview ${delta !== null && delta < 0 ? 'invalid' : ''}`}>
                <span>Prestasi meter</span>
                <strong>
                  {number(delta)}
                  <small>{equipment?.meter_unit ?? 'HM'}</small>
                </strong>
              </div>
            </div>
            <Field label="Kondisi dalam periode" error={fieldErrors.condition}>
              <Select
                value={form.condition}
                onChange={(e) => set('condition', e.target.value as Report['condition'])}
              >
                {['working', 'standby', 'breakdown', 'maintenance'].map((c) => (
                  <option key={c} value={c}>
                    {labels[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lembur operator (menit)" error={fieldErrors.overtime_minutes}>
              <input
                type="number"
                min="0"
                max="1440"
                value={form.overtime_minutes}
                onChange={(e) => set('overtime_minutes', Number(e.target.value))}
              />
            </Field>
            <div className="span-2">
              <div className="section-label">
                <h3>
                  Helper / kernet <small>maksimal 4 personel</small>
                </h3>
                <Button
                  type="button"
                  kind="small secondary"
                  disabled={form.helpers.length >= 4}
                  onClick={() =>
                    set('helpers', [...form.helpers, { person_uuid: '', overtime_minutes: 0 }])
                  }
                >
                  <Plus size={14} />
                  Tambah helper
                </Button>
              </div>
              {form.helpers.map((h, i) => (
                <div className="helper-row" key={i}>
                  <Select
                    value={h.person_uuid}
                    onChange={(e) =>
                      set(
                        'helpers',
                        form.helpers.map((x, j) =>
                          i === j ? { ...x, person_uuid: e.target.value } : x,
                        ),
                      )
                    }
                    required
                    aria-label={`Helper ${i + 1}`}
                  >
                    <option value="">Pilih helper {i + 1}</option>
                    {data.people
                      .filter((p) => p.type === 'helper')
                      .map((p) => (
                        <option key={p.uuid} value={p.uuid}>
                          {p.name}
                        </option>
                      ))}
                  </Select>
                  <input
                    type="number"
                    aria-label={`Lembur helper ${i + 1} dalam menit`}
                    min="0"
                    max="1440"
                    value={h.overtime_minutes}
                    onChange={(e) =>
                      set(
                        'helpers',
                        form.helpers.map((x, j) =>
                          i === j ? { ...x, overtime_minutes: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <span>menit lembur</span>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="Hapus helper"
                    onClick={() =>
                      set(
                        'helpers',
                        form.helpers.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Field label="Catatan / alasan nonoperasi" error={fieldErrors.notes} className="span-2">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Catat kondisi lapangan atau alasan alat tidak bekerja…"
              />
            </Field>
          </div>
        )}
        {step === 1 && (
          <>
            <div className="section-label">
              <div>
                <h3>Detail aktivitas / perjalanan</h3>
                <p>
                  Catat setiap sesi secara berurutan. Tanggal selesai dapat melewati tengah malam.
                </p>
              </div>
              <Button kind="secondary small" type="button" onClick={addActivity}>
                <Plus size={15} />
                Tambah aktivitas
              </Button>
            </div>
            {form.activities.map((a, i) => (
              <div className="activity-form" key={i}>
                <div className="activity-form-head">
                  <strong>
                    <span>{String(i + 1).padStart(2, '0')}</span>Aktivitas {i + 1}
                  </strong>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Hapus aktivitas ${i + 1}`}
                    onClick={() => removeActivity(i)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <Field
                    label={`Mulai (${zoneLabel})`}
                    error={fieldErrors[`activities.${i}.starts_at`]}
                  >
                    <input
                      type="datetime-local"
                      step={1}
                      value={timeInputs[`activities.${i}.starts_at`]?.value ?? toLocal(a.starts_at)}
                      onInput={(e) => updateActivityTime(i, 'starts_at', e.currentTarget.value)}
                      onChange={(e) => updateActivityTime(i, 'starts_at', e.target.value)}
                      required
                    />
                  </Field>
                  <Field
                    label={`Selesai (${zoneLabel})`}
                    error={fieldErrors[`activities.${i}.ends_at`]}
                  >
                    <input
                      type="datetime-local"
                      step={1}
                      value={timeInputs[`activities.${i}.ends_at`]?.value ?? toLocal(a.ends_at)}
                      onInput={(e) => updateActivityTime(i, 'ends_at', e.currentTarget.value)}
                      onChange={(e) => updateActivityTime(i, 'ends_at', e.target.value)}
                      required
                    />
                  </Field>
                  <Field
                    label="Istirahat (menit)"
                    error={fieldErrors[`activities.${i}.break_seconds`]}
                  >
                    <input
                      type="number"
                      min="0"
                      value={a.break_seconds / 60}
                      onChange={(e) =>
                        updateActivity(i, 'break_seconds', Number(e.target.value) * 60)
                      }
                    />
                  </Field>
                  <Field label="Lokasi" error={fieldErrors[`activities.${i}.location_uuid`]}>
                    <Select
                      value={a.location_uuid}
                      onChange={(e) => updateActivity(i, 'location_uuid', e.target.value)}
                    >
                      <option value="">Pilih lokasi</option>
                      {data.locations.map((l) => (
                        <option key={l.uuid} value={l.uuid}>
                          {l.code} · {l.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Uraian kegiatan"
                    error={fieldErrors[`activities.${i}.description`]}
                    className="span-2"
                  >
                    <textarea
                      value={a.description}
                      onChange={(e) => updateActivity(i, 'description', e.target.value)}
                      required
                      rows={2}
                    />
                  </Field>
                  <Field
                    label="Kode kegiatan / reason"
                    error={fieldErrors[`activities.${i}.work_code`]}
                  >
                    <input
                      value={a.work_code ?? ''}
                      onChange={(e) => updateActivity(i, 'work_code', e.target.value)}
                      placeholder="Kode pekerjaan bisnis"
                    />
                  </Field>
                  <Field
                    label="Realisasi detail rencana"
                    error={fieldErrors[`activities.${i}.plan_item_uuid`]}
                  >
                    <Select
                      value={a.plan_item_uuid ?? ''}
                      onChange={(e) => {
                        const item = data.plans
                          .flatMap((p) => p.items)
                          .find((x) => x.uuid === e.target.value);
                        set(
                          'activities',
                          form.activities.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  plan_item_uuid: e.target.value,
                                  unit: item?.unit ?? x.unit,
                                  work_code: item?.work_code ?? x.work_code,
                                }
                              : x,
                          ),
                        );
                      }}
                    >
                      <option value="">Tidak terkait rencana</option>
                      {data.plans
                        .flatMap((p) => p.items)
                        .map((item) => (
                          <option key={item.uuid} value={item.uuid}>
                            {item.description} · {item.unit}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Volume / kuantitas" error={fieldErrors[`activities.${i}.quantity`]}>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={a.quantity}
                      onChange={(e) => updateActivity(i, 'quantity', e.target.value)}
                    />
                  </Field>
                  <Field label="Satuan volume" error={fieldErrors[`activities.${i}.unit`]}>
                    <Select
                      value={a.unit}
                      onChange={(e) => updateActivity(i, 'unit', e.target.value)}
                    >
                      <option value="">Pilih satuan</option>
                      {['M', 'M2', 'M3', 'KG', 'TON', 'PKK', 'L', 'ORANG', 'PALLET'].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </Select>
                  </Field>
                  {equipment?.category === 'vehicle' && (
                    <>
                      <Field label="Asal" error={fieldErrors[`activities.${i}.origin`]}>
                        <input
                          value={a.origin ?? ''}
                          onChange={(e) => updateActivity(i, 'origin', e.target.value)}
                        />
                      </Field>
                      <Field label="Tujuan" error={fieldErrors[`activities.${i}.destination`]}>
                        <input
                          value={a.destination ?? ''}
                          onChange={(e) => updateActivity(i, 'destination', e.target.value)}
                        />
                      </Field>
                      <Field label="Jenis muatan" error={fieldErrors[`activities.${i}.cargo`]}>
                        <input
                          value={a.cargo ?? ''}
                          onChange={(e) => updateActivity(i, 'cargo', e.target.value)}
                        />
                      </Field>
                      <Field
                        label="KM awal perjalanan"
                        error={fieldErrors[`activities.${i}.meter_start`]}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={a.meter_start ?? ''}
                          onChange={(e) => updateActivity(i, 'meter_start', e.target.value)}
                        />
                      </Field>
                      <Field
                        label="KM akhir perjalanan"
                        error={fieldErrors[`activities.${i}.meter_end`]}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={a.meter_end ?? ''}
                          onChange={(e) => updateActivity(i, 'meter_end', e.target.value)}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!form.activities.length && (
              <Empty
                title="Belum ada aktivitas"
                text="Tambahkan sesi kerja, perjalanan, pemanasan, atau sesi pagi/sore untuk mesin."
              />
            )}
            <div className="calculation-note">
              <Clock3 size={16} />
              Durasi kerja netto:{' '}
              <strong>{Number.isFinite(duration) ? number(duration / 3600) : '—'} jam</strong>
              <span>Terpisah dari HM / KM.</span>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="section-label">
              <div>
                <h3>Catatan bahan bakar & pelumas</h3>
                <p>
                  Pengisian berbeda dari konsumsi. Pilih “Perlu verifikasi” jika maknanya belum
                  pasti.
                </p>
              </div>
              <Button
                type="button"
                kind="secondary small"
                onClick={() =>
                  set('fuel_events', [
                    ...form.fuel_events,
                    {
                      uuid: uid(),
                      meaning: 'unverified',
                      quantity: '',
                      unit: 'L',
                      fuel_type: 'Solar',
                      method: 'direct',
                      place: '',
                    },
                  ])
                }
              >
                <Plus size={15} />
                Tambah BBM
              </Button>
            </div>
            {form.fuel_events.map((f, i) => (
              <div className="activity-form" key={f.uuid}>
                <div className="activity-form-head">
                  <strong>
                    <Droplets size={16} />
                    Catatan BBM {i + 1}
                  </strong>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="Hapus catatan BBM"
                    onClick={() =>
                      set(
                        'fuel_events',
                        form.fuel_events.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <Field label="Makna transaksi" error={fieldErrors[`fuel_events.${i}.meaning`]}>
                    <Select
                      value={f.meaning}
                      onChange={(e) => updateFuel(i, 'meaning', e.target.value)}
                    >
                      {['unverified', 'receipt', 'consumption'].map((k) => (
                        <option key={k} value={k}>
                          {labels[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Jenis bahan" error={fieldErrors[`fuel_events.${i}.fuel_type`]}>
                    <Select
                      value={f.fuel_type}
                      onChange={(e) => updateFuel(i, 'fuel_type', e.target.value)}
                    >
                      <option>Solar</option>
                      <option>Bensin</option>
                      <option>Oli</option>
                      <option>Gemuk</option>
                    </Select>
                  </Field>
                  <Field label="Kuantitas" error={fieldErrors[`fuel_events.${i}.quantity`]}>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.001"
                      value={f.quantity}
                      onChange={(e) => updateFuel(i, 'quantity', e.target.value)}
                    />
                  </Field>
                  <Field label="Satuan" error={fieldErrors[`fuel_events.${i}.unit`]}>
                    <Select value={f.unit} onChange={(e) => updateFuel(i, 'unit', e.target.value)}>
                      <option>L</option>
                      <option>KG</option>
                    </Select>
                  </Field>
                  <Field label="Metode" error={fieldErrors[`fuel_events.${i}.method`]}>
                    <Select
                      value={f.method}
                      onChange={(e) => updateFuel(i, 'method', e.target.value)}
                    >
                      <option value="direct">Diukur langsung</option>
                      <option value="stock_balance">Neraca stok · wajib bukti perhitungan</option>
                      <option value="estimate">Estimasi · wajib parameter yang disahkan</option>
                    </Select>
                  </Field>
                  <Field
                    label="Tempat pengisian / sumber"
                    error={fieldErrors[`fuel_events.${i}.place`]}
                  >
                    <input
                      value={f.place}
                      onChange={(e) => updateFuel(i, 'place', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            ))}
            {!form.fuel_events.length && (
              <div className="notice">
                Tidak ada catatan BBM. Nilai kosong tidak dianggap sebagai konsumsi nol.
              </div>
            )}
            <div className="section-label evidence-label">
              <h3>Bukti & lampiran</h3>
              <span>JPG, PNG, PDF · maks. 5 MB / file</span>
            </div>
            <label className="upload-area">
              <Paperclip size={24} />
              <strong>Pilih foto meter, pekerjaan, atau bukti BBM</strong>
              <span>Ketuk untuk memilih file</span>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? []);
                  if (selected.some((f) => f.size > 5 * 1024 * 1024)) {
                    setError(new Error('Ukuran setiap bukti maksimal 5 MB.'));
                    return;
                  }
                  setFiles([...files, ...selected]);
                }}
              />
            </label>
            {[...(form.attachments ?? []).map((f) => f.name), ...files.map((f) => f.name)].map(
              (name, i) => (
                <div key={i} className="attachment-item">
                  <Paperclip size={15} />
                  {name}
                  <span>Siap diunggah</span>
                </div>
              ),
            )}
          </>
        )}
        {step === 3 && (
          <>
            <div className="review-summary">
              <span className="summary-check">
                <FileCheck2 size={28} />
              </span>
              <h3>Periksa ringkasan draft</h3>
              <p>
                Draft belum masuk rekap final. Kirim laporan dari halaman detail setelah seluruh
                data lengkap.
              </p>
            </div>
            <div className="detail-grid">
              <div>
                <span>Equipment</span>
                <strong>{equipment?.name ?? 'Belum dipilih'}</strong>
              </div>
              <div>
                <span>Tanggal / shift</span>
                <strong>
                  {shortDate(form.work_date)} · {form.shift}
                </strong>
              </div>
              <div>
                <span>Operator</span>
                <strong>
                  {data.people.find((p) => p.uuid === form.operator_uuid)?.name ?? 'Belum dipilih'}
                </strong>
              </div>
              <div>
                <span>Prestasi meter</span>
                <strong>
                  {number(delta)} {equipment?.meter_unit}
                </strong>
              </div>
              <div>
                <span>Aktivitas / durasi</span>
                <strong>
                  {form.activities.length} sesi · {number(duration / 3600)} jam
                </strong>
              </div>
              <div>
                <span>Catatan BBM</span>
                <strong>{form.fuel_events.length} transaksi · menunggu pemeriksaan</strong>
              </div>
            </div>
            <div className="notice">
              Seluruh nilai dihitung dan divalidasi kembali di Laravel saat koneksi backend
              tersedia. BBM ambigu tidak masuk konsumsi final.
            </div>
          </>
        )}
        <div className="form-actions step-actions">
          <Button
            type="button"
            kind="secondary"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft size={15} />
            Sebelumnya
          </Button>
          <div>
            <Button type="submit" kind={step === 3 ? 'primary' : 'secondary'} disabled={busy}>
              <Save size={16} />
              {busy ? 'Menyimpan…' : 'Simpan draft'}
            </Button>
            {step < 3 && (
              <Button type="button" kind="primary" onClick={() => setStep(step + 1)}>
                Lanjut
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
export function ReportDetail({
  report,
  onClose,
  onEdit,
  onVerify,
}: {
  report: Report;
  onClose: () => void;
  onEdit: (r: Report) => void;
  onVerify: (r: Report, f: Fuel) => void;
}) {
  const { date, shortDate, zoneLabel } = usePlantTime();
  const { data, run, notify, permissions } = useWorkspace();
  const live = data.reports.find((r) => r.uuid === report.uuid) ?? report;
  const e = data.equipment.find((e) => e.uuid === live.equipment_uuid);
  const operator = data.people.find((p) => p.uuid === live.operator_uuid);
  const [tab, setTab] = useState('detail');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const mayClose = useUnsavedChanges({ decision, reason, confirmed }, busy);
  async function act(name: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await run(`report.${name}`, { uuid: live.uuid, version: live.version, reason, confirmed });
      setDecision('');
      notify(
        `Laporan berhasil ${name === 'submit' ? 'dikirim' : name === 'return' ? 'dikembalikan' : name === 'approve' ? 'disetujui' : 'ditandai sedang diperiksa'}.`,
      );
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Detail laporan harian"
      description={`${e?.code ?? ''} · ${shortDate(live.work_date)} · ${live.shift} · Versi ${live.version}`}
      onClose={() => {
        if (mayClose()) onClose();
      }}
      wide
    >
      <ErrorNotice error={error} />
      <div className="report-detail-banner">
        <span className="equipment-avatar">
          <HardHat size={27} />
        </span>
        <div>
          <h3>{e?.name ?? 'Equipment'}</h3>
          <span>{operator?.name ?? 'Operator belum dipetakan'}</span>
        </div>
        <Badge value={live.status} />
      </div>
      <div className="report-stat-row">
        <div>
          <span>Meter awal → akhir</span>
          <strong>
            {number(live.meter_start)} <ArrowRight size={13} />
            {number(live.meter_end)}
          </strong>
        </div>
        <div>
          <span>Prestasi meter</span>
          <strong>
            {number(live.meter_delta)} <small>{live.meter_unit}</small>
          </strong>
        </div>
        <div>
          <span>Durasi kerja netto</span>
          <strong>
            {number(live.work_seconds / 3600)} <small>jam</small>
          </strong>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'detail' ? 'active' : ''} onClick={() => setTab('detail')}>
          Aktivitas & BBM
        </button>
        <button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          Personel & bukti
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Histori keputusan<span>{live.history.length}</span>
        </button>
      </div>
      {tab === 'detail' && (
        <>
          <div className="section-label">
            <h3>Aktivitas / perjalanan</h3>
            <span>{live.activities.length} sesi</span>
          </div>
          <div className="session-list">
            {live.activities.map((a, i) => (
              <div key={i}>
                <span className="session-number">{i + 1}</span>
                <div>
                  <strong>{a.description}</strong>
                  <p>
                    <Clock3 size={12} />
                    {date(a.starts_at, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    –{' '}
                    {date(a.ends_at, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    {zoneLabel} · istirahat {a.break_seconds / 60} menit
                  </p>
                  <p>
                    <MapPin size={12} />
                    {data.locations.find((l) => l.uuid === a.location_uuid)?.name ??
                      'Lokasi belum dipilih'}
                  </p>
                  {a.origin && (
                    <p>
                      {a.origin} → {a.destination}
                    </p>
                  )}
                </div>
                <strong className="session-quantity">
                  {number(a.quantity)}
                  <small>{a.unit}</small>
                </strong>
              </div>
            ))}
            {!live.activities.length && <Empty title="Belum ada aktivitas" />}
          </div>
          <div className="section-label">
            <h3>Bahan bakar & pelumas</h3>
          </div>
          {live.fuel_events.map((f) => (
            <div key={f.uuid} className="fuel-detail-row">
              <span className="metric-icon cyan">
                <Droplets size={18} />
              </span>
              <div>
                <strong>
                  {number(f.quantity)} {f.unit} {f.fuel_type}
                </strong>
                <small>
                  {labels[f.method]} · {f.place || 'Tempat belum dicatat'}
                </small>
              </div>
              <Badge value={f.verified_at ? f.meaning : 'unverified'} />
              {permissions.includes('fuel-verify') &&
                ['submitted', 'reviewed'].includes(live.status) && (
                  <Button kind="small secondary" onClick={() => onVerify(live, f)}>
                    Verifikasi
                  </Button>
                )}
            </div>
          ))}
          {!live.fuel_events.length && (
            <p className="muted">Tidak ada catatan BBM pada laporan ini.</p>
          )}
          {live.notes && (
            <div className="report-notes">
              <strong>Catatan lapangan</strong>
              <p>{live.notes}</p>
            </div>
          )}
        </>
      )}
      {tab === 'people' && (
        <>
          <div className="detail-grid">
            <div>
              <span>Operator / sopir</span>
              <strong>{operator?.name}</strong>
              <small>{live.overtime_minutes} menit lembur</small>
            </div>
            {live.helpers.map((h, i) => (
              <div key={i}>
                <span>Helper {i + 1}</span>
                <strong>{data.people.find((p) => p.uuid === h.person_uuid)?.name}</strong>
                <small>{h.overtime_minutes} menit lembur</small>
              </div>
            ))}
          </div>
          <h3 className="subheading">Bukti terkait</h3>
          {live.attachments?.length ? (
            live.attachments.map((a) => (
              <div className="attachment-item" key={a.uuid}>
                <Paperclip size={16} />
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.name}
                  </a>
                ) : (
                  <span>{a.name}</span>
                )}
                <small>
                  {a.local ? 'Metadata lokal · berkas belum diunggah' : 'Tersimpan privat'}
                </small>
              </div>
            ))
          ) : (
            <Empty
              title="Belum ada bukti terlampir"
              text="Tambahkan bukti melalui form draft sebelum mengirim laporan."
            />
          )}
        </>
      )}
      {tab === 'history' && (
        <div className="timeline">
          {[...live.history].reverse().map((h, i) => (
            <div key={i}>
              <span className="timeline-dot">
                <Check size={12} />
              </span>
              <div>
                <div>
                  <strong>{labels[h.status] ?? h.status}</strong>
                  <small>v{h.version}</small>
                </div>
                <p>
                  {h.actor} ·{' '}
                  {date(h.at, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  {zoneLabel}
                </p>
                {h.reason && <blockquote>{h.reason}</blockquote>}
              </div>
            </div>
          ))}
        </div>
      )}
      {decision && (
        <div className="decision-panel">
          <strong>
            {decision === 'submit'
              ? 'Konfirmasi pengiriman'
              : decision === 'return'
                ? 'Alasan pengembalian'
                : 'Konfirmasi persetujuan'}
          </strong>
          {decision === 'submit' ? (
            <CheckItem checked={confirmed} onChange={setConfirmed}>
              Saya telah memeriksa identitas, meter, aktivitas, BBM, dan bukti laporan ini.
            </CheckItem>
          ) : (
            <textarea
              rows={3}
              required={decision === 'return'}
              placeholder={
                decision === 'return'
                  ? 'Jelaskan field dan data yang harus diperbaiki…'
                  : 'Catatan pemeriksaan (opsional)…'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <div>
            <Button kind="secondary small" onClick={() => setDecision('')}>
              Batal
            </Button>
            <Button
              kind="primary small"
              disabled={busy || (decision === 'submit' && !confirmed)}
              onClick={() => act(decision)}
            >
              {busy ? 'Memproses…' : 'Konfirmasi'}
            </Button>
          </div>
        </div>
      )}
      <div className="form-actions">
        <span className="small-text muted">
          <History size={14} />
          Seluruh keputusan disimpan dalam histori.
        </span>
        <div>
          {['draft', 'returned'].includes(live.status) &&
            permissions.some((p) => ['report-own', 'report-delegate'].includes(p)) && (
              <>
                <Button kind="secondary" onClick={() => onEdit(live)}>
                  <Pencil size={15} />
                  Edit draft
                </Button>
                <Button
                  kind="primary"
                  onClick={() => {
                    setDecision('submit');
                    setConfirmed(false);
                  }}
                >
                  <Send size={15} />
                  Kirim laporan
                </Button>
              </>
            )}
          {['submitted', 'reviewed'].includes(live.status) && permissions.includes('approve') && (
            <>
              <Button kind="secondary" onClick={() => setDecision('return')}>
                Kembalikan
              </Button>
              <Button kind="primary" onClick={() => setDecision('approve')}>
                <CheckCheck size={16} />
                Setujui laporan
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
export function FuelVerification({
  report,
  fuel,
  onClose,
  onSaved,
}: {
  report: Report;
  fuel: Fuel;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { shortDate } = usePlantTime();
  const { run, notify } = useWorkspace();
  const [meaning, setMeaning] = useState(fuel.meaning === 'unverified' ? 'receipt' : fuel.meaning);
  const [method, setMethod] = useState(fuel.method);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const mayClose = useUnsavedChanges({ meaning, method, reason }, busy);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await run('fuel.verify', {
        report_uuid: report.uuid,
        version: report.version,
        fuel_uuid: fuel.uuid,
        meaning,
        method,
        reason,
      });
      notify('Keputusan BBM tersimpan beserta histori pemeriksaan.');
      (onSaved ?? onClose)();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Verifikasi makna BBM"
      description={`${number(fuel.quantity)} ${fuel.unit} ${fuel.fuel_type} · ${shortDate(report.work_date)}`}
      onClose={() => {
        if (mayClose()) onClose();
      }}
    >
      <form onSubmit={submit}>
        <ErrorNotice error={error} />
        <div className="notice">
          Pengisian tidak otomatis menjadi konsumsi. Keputusan hanya berlaku untuk catatan BBM
          laporan ini.
        </div>
        <div className="form-grid">
          <Field
            label="Makna yang diverifikasi"
            error={error instanceof ActionError ? error.errors.meaning : undefined}
          >
            <Select value={meaning} onChange={(e) => setMeaning(e.target.value as typeof meaning)}>
              <option value="receipt">Pengisian / penerimaan</option>
              <option value="consumption">Konsumsi / dipakai</option>
            </Select>
          </Field>
          <Field
            label="Metode"
            error={error instanceof ActionError ? error.errors.method : undefined}
          >
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {['direct', 'stock_balance', 'estimate'].map((m) => (
                <option value={m} key={m}>
                  {labels[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Dasar keputusan / referensi bukti"
            className="span-2"
            error={error instanceof ActionError ? error.errors.reason : undefined}
          >
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              placeholder="Tuliskan bukti atau konfirmasi yang mendasari keputusan…"
            />
          </Field>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            kind="secondary"
            onClick={() => {
              if (mayClose()) onClose();
            }}
          >
            Batal
          </Button>
          <Button kind="primary" disabled={busy}>
            <ShieldCheck size={16} />
            {busy ? 'Menyimpan…' : 'Simpan verifikasi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
