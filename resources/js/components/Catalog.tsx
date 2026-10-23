import { usePlantTime } from '../lib/usePlantTime';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Copy,
  HardHat,
  MapPin,
  Pencil,
  Plus,
  Search,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import { useServerSearch, useWorkspace } from '../lib/workspace';
import {
  labels,
  number,
  type Equipment,
  type Person,
  type Location,
  type Report,
} from '../lib/types';
import {
  Badge,
  Button,
  DataTable,
  Empty,
  Modal,
  PageTitle,
  Panel,
  SearchInput,
  Select,
} from './UI';
import RecordForm, { type FormKind } from './RecordForm';
export function EquipmentPage({ onReport }: { onReport: (r: Report) => void }) {
  const { date, shortDate } = usePlantTime();
  const { data, permissions, notify, filters, filter } = useWorkspace();
  const [search, setSearch] = useServerSearch();
  const category = filters.category ?? '';
  const setCategory = (category: string) => filter({ category, equipment_page: 1 });
  const condition = filters.condition ?? '';
  const setCondition = (condition: string) => filter({ condition, equipment_page: 1 });
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [edit, setEdit] = useState<Equipment | true | null>(null);
  const [tab, setTab] = useState('overview');
  const filtered = data.catalog_rows?.equipment ?? [];
  const canManage = permissions.includes('master');
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRASI / ASET"
        title="Master equipment"
        description="Satu identitas alat, seluruh riwayat operasionalnya."
        actions={
          canManage && (
            <Button kind="primary" onClick={() => setEdit(true)}>
              <Plus size={17} />
              Tambah equipment
            </Button>
          )
        }
      />
      <div className="summary-strip">
        {[
          { label: 'Seluruh equipment', count: data.equipment.length, icon: Truck },
          {
            label: 'Bekerja',
            count: data.equipment.filter((e) => e.condition === 'working').length,
            icon: HardHat,
          },
          {
            label: 'Siap / standby',
            count: data.equipment.filter((e) => e.condition === 'standby').length,
            icon: Building2,
          },
          {
            label: 'Dalam perawatan',
            count: data.equipment.filter((e) => ['breakdown', 'maintenance'].includes(e.condition))
              .length,
            icon: Wrench,
          },
        ].map((s) => (
          <div key={s.label}>
            <s.icon size={19} />
            <span>{s.label}</span>
            <strong>{s.count}</strong>
          </div>
        ))}
      </div>
      <Panel>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, kode, atau nomor polisi…"
          />
          <div>
            <Select
              aria-label="Filter kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Semua kategori</option>
              {['heavy_equipment', 'vehicle', 'engine', 'genset'].map((c) => (
                <option key={c} value={c}>
                  {labels[c]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter kondisi"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="">Semua kondisi</option>
              {['working', 'standby', 'breakdown', 'maintenance', 'unknown'].map((c) => (
                <option key={c} value={c}>
                  {labels[c]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <DataTable
          rows={filtered}
          resource="equipment"
          keyOf={(e) => e.uuid}
          onRow={(e) => {
            setSelected(e);
            setTab('overview');
          }}
          emptyTitle="Equipment tidak ditemukan"
          emptyText="Tambahkan master alat atau sesuaikan pencarian Anda."
          columns={[
            {
              label: 'Equipment',
              render: (e) => (
                <div className="cell-identity">
                  <span className={`equipment-avatar ${e.category === 'vehicle' ? 'vehicle' : ''}`}>
                    {e.category === 'vehicle' ? <Truck size={20} /> : <HardHat size={20} />}
                  </span>
                  <span>
                    <strong>{e.name}</strong>
                    <small className="code">{e.code}</small>
                  </span>
                </div>
              ),
            },
            {
              label: 'Kategori / kepemilikan',
              render: (e) => (
                <div className="cell-stack">
                  <span>{labels[e.category]}</span>
                  <small>{labels[e.ownership] ?? e.ownership}</small>
                </div>
              ),
            },
            {
              label: 'Meter terakhir',
              render: (e) => (
                <span className="meter-value">
                  {number(e.last_meter)} <small>{e.meter_unit}</small>
                </span>
              ),
            },
            { label: 'Kondisi alat', render: (e) => <Badge value={e.condition} /> },
            {
              label: 'Dikonfirmasi',
              render: (e) => (
                <span className="muted">
                  {e.condition_at ? shortDate(e.condition_at) : 'Belum ada konfirmasi'}
                </span>
              ),
            },
            {
              label: '',
              render: (e) => (
                <button
                  className="icon-button"
                  aria-label={`Lihat ${e.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(e);
                  }}
                >
                  <ArrowUpRight size={17} />
                </button>
              ),
            },
          ]}
        />
      </Panel>
      {selected && (
        <Modal
          title={selected.name}
          description={selected.code}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="equipment-detail-head">
            <div>
              <Badge value={selected.condition} />
              <span>
                {labels[selected.category]} <b>·</b>{' '}
                {labels[selected.ownership] ?? selected.ownership}
              </span>
            </div>
            {canManage && (
              <Button
                kind="secondary small"
                onClick={() => {
                  setEdit(selected);
                  setSelected(null);
                }}
              >
                <Pencil size={14} />
                Edit master
              </Button>
            )}
          </div>
          <div className="tabs">
            {[
              ['overview', 'Informasi'],
              ['operations', 'Aktivitas VRA'],
              ['fuel', 'BBM'],
              ['maintenance', 'Perawatan'],
            ].map(([key, label]) => (
              <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'overview' && (
            <div className="detail-grid">
              {[
                ['Kode equipment', selected.code],
                ['Nama / model', selected.model || selected.name],
                ['Nomor polisi', selected.plate || 'Tidak berlaku / belum tersedia'],
                ['Satuan meter', selected.meter_unit],
                ['Meter terakhir disahkan', number(selected.last_meter)],
                ['Status master', selected.active ? 'Aktif' : 'Nonaktif'],
                [
                  'Pembaruan kondisi',
                  selected.condition_at
                    ? date(selected.condition_at, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Belum dikonfirmasi',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
          {tab === 'operations' && (
            <div className="detail-list">
              {data.reports
                .filter((r) => r.equipment_uuid === selected.uuid)
                .map((r) => (
                  <button
                    key={r.uuid}
                    onClick={() => {
                      setSelected(null);
                      onReport(r);
                    }}
                  >
                    <span>
                      <strong>
                        {shortDate(r.work_date)} · {r.shift}
                      </strong>
                      <small>{r.activities[0]?.description ?? 'Draft belum lengkap'}</small>
                    </span>
                    <Badge value={r.status} />
                    <ArrowRight size={16} />
                  </button>
                ))}
              {!data.reports.some((r) => r.equipment_uuid === selected.uuid) && (
                <Empty title="Belum ada aktivitas" />
              )}
            </div>
          )}
          {tab === 'fuel' && (
            <div className="detail-list">
              {data.reports
                .filter((r) => r.equipment_uuid === selected.uuid)
                .flatMap((r) =>
                  r.fuel_events.map((f) => (
                    <div className="detail-list-row" key={f.uuid}>
                      <span>
                        <strong>
                          {f.fuel_type} · {number(f.quantity)} {f.unit}
                        </strong>
                        <small>
                          {shortDate(r.work_date)} · {labels[f.method]}
                        </small>
                      </span>
                      <Badge value={f.verified_at ? f.meaning : 'unverified'} />
                    </div>
                  )),
                )}
              {!data.reports.some(
                (r) => r.equipment_uuid === selected.uuid && r.fuel_events.length,
              ) && <Empty title="Belum ada catatan BBM" />}
            </div>
          )}
          {tab === 'maintenance' && (
            <div className="detail-list">
              {data.orders
                .filter((o) => o.equipment_uuid === selected.uuid)
                .map((o) => (
                  <div key={o.uuid} className="detail-list-row">
                    <span>
                      <strong>{labels[o.type]}</strong>
                      <small>{o.diagnosis}</small>
                    </span>
                    <Badge value={o.status} />
                  </div>
                ))}
              {!data.orders.some((o) => o.equipment_uuid === selected.uuid) && (
                <Empty title="Belum ada riwayat perawatan" />
              )}
            </div>
          )}
        </Modal>
      )}
      {edit && (
        <RecordForm
          kind="equipment"
          equipment={edit === true ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
export function MasterPage({ kind }: { kind: 'people' | 'locations' }) {
  const { data, permissions } = useWorkspace();
  const [search, setSearch] = useServerSearch();
  const [create, setCreate] = useState<Person | Location | true | null>(null);
  const people = kind === 'people';
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRASI / REFERENSI"
        title={people ? 'Master personel' : 'Master lokasi'}
        description={
          people
            ? 'Operator, sopir, helper, dan teknisi dalam cakupan plant Anda.'
            : 'Lokasi pekerjaan dengan tipe dan kode yang dapat dipetakan ke SAP.'
        }
        actions={
          permissions.includes('master') && (
            <Button kind="primary" onClick={() => setCreate(true)}>
              <Plus size={17} />
              Tambah {people ? 'personel' : 'lokasi'}
            </Button>
          )
        }
      />
      <Panel>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Cari nama atau kode ${people ? 'personel' : 'lokasi'}…`}
          />
          <span className="table-count">
            {number(data.pagination?.[kind]?.total)} master tercatat
          </span>
        </div>
        {people ? (
          <DataTable
            rows={data.catalog_rows?.people ?? []}
            resource="people"
            keyOf={(p) => p.uuid}
            onRow={permissions.includes('master') ? (record) => setCreate(record) : undefined}
            columns={[
              {
                label: 'Personel',
                render: (p) => (
                  <div className="cell-identity">
                    <span className="person-avatar">
                      {p.name
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small className="code">{p.code}</small>
                    </span>
                  </div>
                ),
              },
              { label: 'Jenis personel', render: (p) => <span>{labels[p.type] ?? p.type}</span> },
              {
                label: 'Status',
                render: (p) => (
                  <Badge value={p.active ? 'active' : 'inactive'}>
                    {p.active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            rows={data.catalog_rows?.locations ?? []}
            resource="locations"
            keyOf={(p) => p.uuid}
            onRow={permissions.includes('master') ? (record) => setCreate(record) : undefined}
            columns={[
              {
                label: 'Lokasi',
                render: (p) => (
                  <div className="cell-identity">
                    <span className="equipment-avatar">
                      <MapPin size={19} />
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small className="code">{p.code}</small>
                    </span>
                  </div>
                ),
              },
              { label: 'Tipe', render: (p) => <span className="capitalize">{p.type}</span> },
              {
                label: 'Kode SAP',
                render: (p) => <span className="code">{p.sap_code || 'Belum dipetakan'}</span>,
              },
            ]}
          />
        )}
      </Panel>
      {create && (
        <RecordForm
          kind={people ? 'person' : 'location'}
          record={create === true ? undefined : create}
          onClose={() => setCreate(null)}
        />
      )}
    </>
  );
}
