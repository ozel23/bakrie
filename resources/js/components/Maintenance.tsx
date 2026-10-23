import { usePlantTime } from '../lib/usePlantTime';
import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  Plus,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useServerSearch, useWorkspace } from '../lib/workspace';
import { type MaintenanceOrder, labels, number } from '../lib/types';
import { Badge, Button, DataTable, Empty, Modal, PageTitle, Panel, SearchInput } from './UI';
import RecordForm, { type FormKind } from './RecordForm';
export default function MaintenancePage() {
  const { date, shortDate } = usePlantTime();
  const { data, permissions } = useWorkspace();
  const [tab, setTab] = useState('orders');
  const [search, setSearch] = useServerSearch();
  const [form, setForm] = useState<FormKind | null>(null);
  const [selected, setSelected] = useState<MaintenanceOrder | null>(null);
  const [formOrder, setFormOrder] = useState<MaintenanceOrder | undefined>();
  const [initialEquipment, setInitialEquipment] = useState<string | undefined>();
  const orders = data.orders;
  const live = selected ? (data.orders.find((o) => o.uuid === selected.uuid) ?? selected) : null;
  return (
    <>
      <PageTitle
        eyebrow="PERAWATAN / KETERSEDIAAN ALAT"
        title="Perawatan & kerusakan"
        description="Tangani gangguan, catat tindakan, dan pastikan alat aman sebelum kembali bekerja."
        actions={
          <>
            {permissions.includes('breakdown') && (
              <Button kind="secondary" onClick={() => setForm('breakdown')}>
                <AlertTriangle size={16} />
                Laporkan kerusakan
              </Button>
            )}
            {permissions.includes('maintain') && (
              <Button
                kind="primary"
                onClick={() => {
                  setInitialEquipment(undefined);
                  setForm('order');
                }}
              >
                <Plus size={17} />
                Buat work order
              </Button>
            )}
          </>
        }
      />
      <div className="maintenance-summary">
        <div>
          <span className="metric-icon orange">
            <AlertTriangle size={21} />
          </span>
          <span>
            <small>Kerusakan terbuka</small>
            <strong>{number(data.metrics.open_breakdowns)}</strong>
          </span>
        </div>
        <div>
          <span className="metric-icon blue">
            <Wrench size={21} />
          </span>
          <span>
            <small>Work order aktif</small>
            <strong>{number(data.metrics.active_orders)}</strong>
          </span>
        </div>
        <div>
          <span className="metric-icon green">
            <CheckCheck size={21} />
          </span>
          <span>
            <small>Selesai & dirilis</small>
            <strong>{number(data.metrics.released_orders)}</strong>
          </span>
        </div>
      </div>
      <div className="tabs page-tabs">
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          Work order<span>{number(data.metrics.orders)}</span>
        </button>
        <button
          className={tab === 'breakdowns' ? 'active' : ''}
          onClick={() => setTab('breakdowns')}
        >
          Laporan kerusakan<span>{number(data.metrics.breakdowns)}</span>
        </button>
      </div>
      <Panel>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari equipment, diagnosis, atau keluhan…"
          />
          <span className="muted small-text">
            <ShieldCheck size={14} />
            Perawatan terpisah dari aktivitas VRA
          </span>
        </div>
        {tab === 'orders' ? (
          <DataTable
            rows={orders}
            resource="orders"
            keyOf={(o) => o.uuid}
            onRow={setSelected}
            emptyTitle="Belum ada work order"
            columns={[
              {
                label: 'Equipment / pekerjaan',
                render: (o) => (
                  <div className="cell-stack cell-description">
                    <strong>
                      {data.equipment.find((e) => e.uuid === o.equipment_uuid)?.name ?? '—'}
                    </strong>
                    <small>{o.diagnosis}</small>
                  </div>
                ),
              },
              { label: 'Jenis perawatan', render: (o) => <Badge value={o.type} /> },
              { label: 'Mulai', render: (o) => <span>{shortDate(o.starts_at)}</span> },
              { label: 'Tindakan', render: (o) => <span>{o.actions.length} tindakan</span> },
              { label: 'Status', render: (o) => <Badge value={o.status} /> },
              {
                label: '',
                render: (o) => (
                  <button
                    className="icon-button"
                    aria-label="Lihat work order"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(o);
                    }}
                  >
                    <ArrowRight size={17} />
                  </button>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            resource="breakdowns"
            rows={data.breakdowns}
            keyOf={(b) => b.uuid}
            emptyTitle="Tidak ada laporan kerusakan"
            columns={[
              {
                label: 'Equipment',
                render: (b) => (
                  <div className="cell-stack">
                    <strong>{data.equipment.find((e) => e.uuid === b.equipment_uuid)?.name}</strong>
                    <small>{shortDate(b.occurred_at)}</small>
                  </div>
                ),
              },
              {
                label: 'Keluhan',
                render: (b) => <span className="cell-description">{b.description}</span>,
              },
              { label: 'Prioritas', render: (b) => <Badge value={b.severity} /> },
              { label: 'Status', render: (b) => <Badge value={b.status} /> },
              {
                label: 'Tindakan',
                render: (b) =>
                  b.status === 'open' && permissions.includes('maintain') ? (
                    <Button
                      kind="secondary small"
                      onClick={() => {
                        setInitialEquipment(b.equipment_uuid);
                        setForm('order');
                      }}
                    >
                      Tindak lanjut
                      <ArrowRight size={13} />
                    </Button>
                  ) : (
                    <span className="muted">—</span>
                  ),
              },
            ]}
          />
        )}
      </Panel>
      {live && (
        <Modal
          title="Detail work order"
          description={`${data.equipment.find((e) => e.uuid === live.equipment_uuid)?.code} · Versi ${live.version}`}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="report-detail-banner">
            <span className="equipment-avatar">
              <Wrench size={25} />
            </span>
            <div>
              <h3>{data.equipment.find((e) => e.uuid === live.equipment_uuid)?.name}</h3>
              <span>
                {labels[live.type]} · Mulai {shortDate(live.starts_at)}
              </span>
            </div>
            <Badge value={live.status} />
          </div>
          <div className="report-notes">
            <strong>Diagnosis / lingkup perawatan</strong>
            <p>{live.diagnosis}</p>
          </div>
          <div className="section-label">
            <h3>Tindakan & spare part</h3>
            {permissions.includes('maintain') && live.status !== 'released' && (
              <Button
                kind="secondary small"
                onClick={() => {
                  setFormOrder(live);
                  setSelected(null);
                  setForm('action');
                }}
              >
                <Plus size={14} />
                Catat tindakan
              </Button>
            )}
          </div>
          {live.actions.map((a) => (
            <div key={a.uuid} className="maintenance-action">
              <div>
                <span className="success-icon">
                  <Check size={15} />
                </span>
                <div>
                  <strong>{a.description}</strong>
                  <small>
                    {data.people.find((p) => p.uuid === a.technician_uuid)?.name} ·{' '}
                    {shortDate(a.starts_at)}
                  </small>
                </div>
              </div>
              <p>{a.result}</p>
              {a.parts?.length > 0 && (
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Spare part</th>
                      <th>Jumlah</th>
                      <th>Referensi gudang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.parts.map((p, i) => (
                      <tr key={i}>
                        <td>
                          {p.code} · {p.name}
                        </td>
                        <td>
                          {number(p.quantity)} {p.unit}
                        </td>
                        <td>{p.warehouse_reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {!live.actions.length && (
            <Empty
              title="Tindakan belum dicatat"
              text="Catat teknisi, waktu, tindakan, hasil, dan spare part yang dipakai."
            />
          )}
          {live.release_checklist && (
            <div className="release-complete">
              <ShieldCheck size={22} />
              <div>
                <strong>Pemeriksaan akhir telah dikonfirmasi</strong>
                <p>{live.release_checklist.notes}</p>
              </div>
            </div>
          )}
          <div className="form-actions">
            <span className="small-text muted">
              Penutupan satu WO tidak menghapus blokir lainnya.
            </span>
            {permissions.includes('release') && live.status !== 'released' && (
              <Button
                kind="primary"
                onClick={() => {
                  setFormOrder(live);
                  setSelected(null);
                  setForm('release');
                }}
              >
                <ShieldCheck size={16} />
                Pemeriksaan & rilis
              </Button>
            )}
          </div>
        </Modal>
      )}
      {form && (
        <RecordForm
          kind={form}
          order={formOrder}
          initialEquipment={initialEquipment}
          onClose={() => {
            setForm(null);
            setFormOrder(undefined);
          }}
        />
      )}
    </>
  );
}
