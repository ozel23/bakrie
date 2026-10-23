import { usePlantTime } from '../lib/usePlantTime';
import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { ActionError, useUnsavedChanges, useWorkspace } from '../lib/workspace';
import {
  type Equipment,
  type Person,
  type Location,
  type MaintenanceOrder,
  labels,
} from '../lib/types';
import { Button, Field, Select, Modal, ErrorNotice, CheckItem } from './UI';
export type FormKind =
  | 'equipment'
  | 'person'
  | 'location'
  | 'plan'
  | 'assignment'
  | 'breakdown'
  | 'order'
  | 'action'
  | 'release';
const titles: Record<FormKind, string> = {
  equipment: 'Equipment',
  person: 'Personel',
  location: 'Lokasi',
  plan: 'Rencana kerja',
  assignment: 'Penugasan',
  breakdown: 'Laporan kerusakan',
  order: 'Work order perawatan',
  action: 'Tindakan perawatan',
  release: 'Pemeriksaan akhir & rilis',
};
const actionNames: Record<FormKind, string> = {
  equipment: 'equipment.save',
  person: 'person.save',
  location: 'location.save',
  plan: 'plan.create',
  assignment: 'assignment.create',
  breakdown: 'breakdown.create',
  order: 'order.create',
  action: 'order.action',
  release: 'order.release',
};
export default function RecordForm({
  kind,
  onClose,
  equipment,
  record,
  order,
  initialEquipment,
}: {
  kind: FormKind;
  onClose: () => void;
  equipment?: Equipment;
  record?: Person | Location;
  order?: MaintenanceOrder;
  initialEquipment?: string;
}) {
  const { today, localTime, iso, zoneLabel } = usePlantTime();
  const { data, run, notify, plantUuid } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState<Record<string, string>>({
    uuid: equipment?.uuid ?? record?.uuid ?? order?.uuid ?? '',
    code: equipment?.code ?? record?.code ?? '',
    name: equipment?.name ?? record?.name ?? '',
    category: equipment?.category ?? 'heavy_equipment',
    model: equipment?.model ?? '',
    plate: equipment?.plate ?? '',
    ownership: equipment?.ownership ?? 'unverified',
    meter_unit: equipment?.meter_unit ?? 'HM',
    type:
      record?.type ??
      (kind === 'person' ? 'operator' : kind === 'location' ? 'block' : 'preventive'),
    equipment_uuid: initialEquipment ?? order?.equipment_uuid ?? '',
    operator_uuid: '',
    plan_item_uuid: '',
    location_uuid: '',
    work_code: '',
    description: '',
    title: '',
    target: '',
    unit: 'M',
    starts_on: today(),
    ends_on: today(),
    starts_at: localTime(),
    ends_at: `${today()}T16:00`,
    occurred_at: localTime(),
    severity: 'medium',
    diagnosis: '',
    reason: '',
    notes: '',
    breakdown_uuid: '',
    technician_uuid: '',
    result: '',
    sap_code: record && 'sap_code' in record ? (record.sap_code ?? '') : '',
    parent_uuid: record && 'parent_uuid' in record ? (record.parent_uuid ?? '') : '',
  });
  const [active, setActive] = useState(equipment?.active ?? record?.active ?? true);
  const [checks, setChecks] = useState({ functional_test: false, safety_check: false });
  const [parts, setParts] = useState<
    { code: string; name: string; quantity: string; unit: string; warehouse_reference: string }[]
  >([]);
  const mayClose = useUnsavedChanges({ form, active, checks, parts }, busy);
  const fieldErrors = error instanceof ActionError ? error.errors : {};
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const input = (key: string, label: string, required = true, type = 'text', hint?: string) => (
    <Field
      label={label}
      hint={hint}
      error={fieldErrors[key] ?? (kind === 'plan' ? fieldErrors[`items.0.${key}`] : undefined)}
    >
      <input
        type={type}
        value={form[key]}
        onInput={(e) => set(key, e.currentTarget.value)}
        onChange={(e) => set(key, e.target.value)}
        required={required}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.001' : type === 'datetime-local' ? 1 : undefined}
      />
    </Field>
  );
  const pick = (
    key: string,
    label: string,
    rows: { uuid: string; name?: string; description?: string; code?: string }[],
    required = true,
  ) => (
    <Field
      label={label}
      error={fieldErrors[key] ?? (kind === 'plan' ? fieldErrors[`items.0.${key}`] : undefined)}
    >
      <Select
        value={form[key]}
        onInput={(e) => set(key, e.currentTarget.value)}
        onChange={(e) => set(key, e.target.value)}
        required={required}
      >
        <option value="">Pilih {label.toLowerCase()}</option>
        {rows.map((row) => (
          <option key={row.uuid} value={row.uuid}>
            {row.code ? `${row.code} · ` : ''}
            {row.name ?? row.description}
          </option>
        ))}
      </Select>
    </Field>
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let payload: Record<string, unknown> = {};
      if (kind === 'equipment')
        payload = {
          ...Object.fromEntries(
            ['uuid', 'code', 'name', 'category', 'model', 'plate', 'ownership', 'meter_unit'].map(
              (k) => [k, form[k]],
            ),
          ),
          active,
          version: equipment?.version ?? 0,
          plant_uuid: plantUuid,
        };
      if (kind === 'person')
        payload = {
          uuid: record?.uuid,
          code: form.code,
          name: form.name,
          type: form.type,
          active,
          version: record?.version ?? 0,
          plant_uuid: plantUuid,
        };
      if (kind === 'location')
        payload = {
          code: form.code,
          name: form.name,
          type: form.type,
          sap_code: form.sap_code,
          parent_uuid: form.parent_uuid || null,
          uuid: record?.uuid,
          active,
          version: record?.version ?? 0,
          plant_uuid: plantUuid,
        };
      if (kind === 'plan')
        payload = {
          title: form.title,
          starts_on: form.starts_on,
          ends_on: form.ends_on,
          notes: form.notes,
          plant_uuid: plantUuid,
          items: [
            {
              location_uuid: form.location_uuid,
              work_code: form.work_code,
              description: form.description,
              target: form.target,
              unit: form.unit,
            },
          ],
        };
      if (kind === 'assignment')
        payload = {
          equipment_uuid: form.equipment_uuid,
          operator_uuid: form.operator_uuid,
          plan_item_uuid: form.plan_item_uuid || null,
          starts_at: iso(form.starts_at),
          ends_at: iso(form.ends_at),
          reason: form.reason,
        };
      if (kind === 'breakdown')
        payload = {
          equipment_uuid: form.equipment_uuid,
          occurred_at: iso(form.occurred_at),
          description: form.description,
          severity: form.severity,
        };
      if (kind === 'order')
        payload = {
          equipment_uuid: form.equipment_uuid,
          breakdown_uuid: form.type === 'corrective' ? form.breakdown_uuid || null : null,
          type: form.type,
          diagnosis: form.diagnosis,
          starts_at: iso(form.starts_at),
        };
      if (kind === 'action')
        payload = {
          uuid: order?.uuid,
          version: order?.version,
          technician_uuid: form.technician_uuid,
          starts_at: iso(form.starts_at),
          ends_at: iso(form.ends_at),
          description: form.description,
          result: form.result,
          parts,
        };
      if (kind === 'release')
        payload = { uuid: order?.uuid, version: order?.version, ...checks, notes: form.notes };
      if (['assignment', 'action'].includes(kind) && form.ends_at <= form.starts_at)
        throw new Error('Waktu selesai harus setelah mulai.');
      if (kind === 'plan' && form.ends_on < form.starts_on)
        throw new Error('Tanggal akhir harus setelah tanggal mulai.');
      await run(actionNames[kind], payload);
      notify(`${titles[kind]} berhasil ${kind === 'release' ? 'dirilis' : 'disimpan'}.`);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${equipment || record ? 'Edit' : kind === 'release' ? '' : 'Tambah'} ${titles[kind].toLowerCase()}`}
      description={'Data akan divalidasi sesuai plant dan kewenangan Anda.'}
      onClose={() => {
        if (mayClose()) onClose();
      }}
      wide={kind === 'action'}
    >
      <form onSubmit={submit} className="record-form">
        <ErrorNotice error={error} />
        <div className="form-grid">
          {kind === 'equipment' && (
            <>
              {input('code', 'Kode equipment')}
              {input('name', 'Nama equipment')}
              <Field label="Kategori">
                <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {['heavy_equipment', 'vehicle', 'engine', 'genset'].map((k) => (
                    <option key={k} value={k}>
                      {labels[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Satuan meter">
                <Select value={form.meter_unit} onChange={(e) => set('meter_unit', e.target.value)}>
                  {['HM', 'KM', 'H'].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </Select>
              </Field>
              {input('model', 'Merek / model', false)}
              {input('plate', 'Nomor polisi', false)}
              <Field label="Kepemilikan">
                <Select value={form.ownership} onChange={(e) => set('ownership', e.target.value)}>
                  {['unverified', 'OWN', 'RENT', 'LEND'].map((k) => (
                    <option key={k} value={k}>
                      {labels[k] ?? k}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status master">
                <CheckItem checked={active} onChange={setActive}>
                  Equipment aktif
                </CheckItem>
              </Field>
              <div className="notice span-2">
                Kondisi awal adalah “Belum dikonfirmasi”. Kondisi operasional diperbarui melalui
                kejadian yang dapat ditelusuri.
              </div>
            </>
          )}
          {kind === 'person' && (
            <>
              {input('code', 'Kode personel')}
              {input('name', 'Nama lengkap')}
              <Field label="Jenis personel">
                <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {['operator', 'driver', 'helper', 'technician'].map((k) => (
                    <option key={k} value={k}>
                      {labels[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="notice span-2">
                Personel dapat tercatat tanpa akun login. Kode disimpan sebagai teks untuk
                mempertahankan nol awal.
              </div>
            </>
          )}
          {kind === 'location' && (
            <>
              {input('code', 'Kode lokasi')}
              {input('name', 'Nama lokasi')}
              <Field label="Tipe lokasi">
                <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {[
                    'estate',
                    'division',
                    'field',
                    'block',
                    'workshop',
                    'factory',
                    'office',
                    'route',
                  ].map((k) => (
                    <option key={k} value={k}>
                      {
                        {
                          estate: 'Estate',
                          division: 'Divisi',
                          field: 'Field',
                          block: 'Blok',
                          workshop: 'Workshop',
                          factory: 'Pabrik',
                          office: 'Kantor / HO',
                          route: 'Rute',
                        }[k]
                      }
                    </option>
                  ))}
                </Select>
              </Field>
              {input('sap_code', 'Kode SAP', false)}
              {pick(
                'parent_uuid',
                'Induk lokasi',
                data.locations.filter((location) => location.uuid !== record?.uuid),
                false,
              )}
            </>
          )}
          {kind === 'plan' && (
            <>
              {input('title', 'Nama rencana kerja')}
              {pick('location_uuid', 'Lokasi', data.locations)}
              {input('starts_on', 'Periode mulai', true, 'date')}
              {input('ends_on', 'Periode akhir', true, 'date')}
              {input('work_code', 'Kode jenis pekerjaan')}
              {input('description', 'Uraian pekerjaan')}
              {input('target', 'Target volume', true, 'number')}
              {input('unit', 'Satuan target')}
              <Field label="Catatan" className="span-2">
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </>
          )}
          {['assignment', 'breakdown', 'order'].includes(kind) &&
            pick(
              'equipment_uuid',
              'Equipment',
              data.equipment.filter((e) => e.active),
            )}
          {kind === 'assignment' && (
            <>
              {pick(
                'operator_uuid',
                'Operator / sopir',
                data.people.filter((p) => p.active && ['operator', 'driver'].includes(p.type)),
              )}
              {pick(
                'plan_item_uuid',
                'Detail rencana',
                data.plans.flatMap((p) => p.items),
                false,
              )}
              {input('starts_at', `Mulai (${zoneLabel})`, true, 'datetime-local')}
              {input('ends_at', `Selesai (${zoneLabel})`, true, 'datetime-local')}
              <Field
                label="Alasan penugasan ad hoc"
                className="span-2"
                hint="Wajib jika penugasan tidak terkait rencana."
              >
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => set('reason', e.target.value)}
                />
              </Field>
            </>
          )}
          {kind === 'breakdown' && (
            <>
              {input('occurred_at', `Waktu kejadian (${zoneLabel})`, true, 'datetime-local')}
              <Field label="Prioritas">
                <Select value={form.severity} onChange={(e) => set('severity', e.target.value)}>
                  {['low', 'medium', 'high', 'critical'].map((k) => (
                    <option key={k} value={k}>
                      {labels[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Keluhan / kerusakan" className="span-2">
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  required
                />
              </Field>
              <div className="notice span-2">
                Kerusakan membuka interval downtime dan memblokir jadwal penugasan alat yang
                beririsan.
              </div>
            </>
          )}
          {kind === 'order' && (
            <>
              <Field label="Jenis perawatan">
                <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                  <option value="preventive">Preventive · berkala</option>
                  <option value="corrective">Corrective · perbaikan</option>
                </Select>
              </Field>
              {input('starts_at', `Mulai perawatan (${zoneLabel})`, true, 'datetime-local')}
              {form.type === 'corrective' && (
                <Field label="Laporan kerusakan terkait">
                  <Select
                    value={form.breakdown_uuid}
                    onChange={(e) => set('breakdown_uuid', e.target.value)}
                  >
                    <option value="">Tanpa referensi breakdown</option>
                    {data.breakdowns
                      .filter(
                        (b) => b.status === 'open' && b.equipment_uuid === form.equipment_uuid,
                      )
                      .map((b) => (
                        <option key={b.uuid} value={b.uuid}>
                          {b.description}
                        </option>
                      ))}
                  </Select>
                </Field>
              )}
              <Field label="Diagnosis / lingkup perawatan" className="span-2">
                <textarea
                  required
                  rows={4}
                  value={form.diagnosis}
                  onChange={(e) => set('diagnosis', e.target.value)}
                />
              </Field>
              <div className="notice span-2">
                WO preventive dapat dibuat langsung tanpa membuat breakdown fiktif.
              </div>
            </>
          )}
          {kind === 'action' && (
            <>
              {pick(
                'technician_uuid',
                'Teknisi',
                data.people.filter((p) => p.type === 'technician'),
              )}
              {input('starts_at', `Mulai tindakan (${zoneLabel})`, true, 'datetime-local')}
              {input('ends_at', `Selesai tindakan (${zoneLabel})`, true, 'datetime-local')}
              <Field label="Tindakan">
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
              <Field label="Hasil pemeriksaan" className="span-2">
                <textarea
                  required
                  rows={3}
                  value={form.result}
                  onChange={(e) => set('result', e.target.value)}
                />
              </Field>
              <div className="span-2">
                <div className="section-label">
                  <h3>Pemakaian spare part</h3>
                  <Button
                    type="button"
                    kind="small secondary"
                    onClick={() =>
                      setParts([
                        ...parts,
                        { code: '', name: '', quantity: '1', unit: 'PCS', warehouse_reference: '' },
                      ])
                    }
                  >
                    <Plus size={14} />
                    Tambah part
                  </Button>
                </div>
                {parts.map((p, i) => (
                  <div className="part-row" key={i}>
                    {(['code', 'name', 'quantity', 'unit', 'warehouse_reference'] as const).map(
                      (k) => (
                        <input
                          key={k}
                          aria-label={`${k} part ${i + 1}`}
                          placeholder={
                            {
                              code: 'Kode part',
                              name: 'Nama part',
                              quantity: 'Qty',
                              unit: 'Satuan',
                              warehouse_reference: 'Referensi gudang',
                            }[k]
                          }
                          type={k === 'quantity' ? 'number' : 'text'}
                          min={k === 'quantity' ? '0.001' : undefined}
                          step={k === 'quantity' ? '0.001' : undefined}
                          value={p[k]}
                          required={k !== 'warehouse_reference'}
                          onChange={(e) =>
                            setParts(
                              parts.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)),
                            )
                          }
                        />
                      ),
                    )}
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label="Hapus part"
                      onClick={() => setParts(parts.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {kind === 'release' && (
            <>
              <div className="span-2 checklist">
                <CheckItem
                  checked={checks.functional_test}
                  onChange={(v) => setChecks({ ...checks, functional_test: v })}
                >
                  Uji fungsi telah dilakukan dan hasilnya memenuhi syarat.
                </CheckItem>
                <CheckItem
                  checked={checks.safety_check}
                  onChange={(v) => setChecks({ ...checks, safety_check: v })}
                >
                  Pemeriksaan keselamatan telah selesai dan alat aman digunakan.
                </CheckItem>
              </div>
              <Field label="Catatan pemeriksaan akhir" className="span-2">
                <textarea
                  required
                  rows={4}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
              <div className="notice span-2">
                Alat kembali standby jika tidak ada breakdown atau work order lain yang masih
                memblokirnya.
              </div>
            </>
          )}
          {['person', 'location'].includes(kind) && (
            <Field label="Status master">
              <CheckItem checked={active} onChange={setActive}>
                Master aktif
              </CheckItem>
            </Field>
          )}
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
          <Button type="submit" kind="primary" disabled={busy}>
            {busy ? (
              'Menyimpan…'
            ) : (
              <>
                <Save size={16} />
                {kind === 'release' ? 'Konfirmasi rilis' : 'Simpan'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
