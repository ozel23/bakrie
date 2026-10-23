import { usePlantTime } from '../lib/usePlantTime';
import { useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, MapPin, Plus, Target, Truck } from 'lucide-react';
import { useServerSearch, useWorkspace } from '../lib/workspace';
import { labels, number } from '../lib/types';
import { Badge, Button, DataTable, Empty, PageTitle, Panel, SearchInput, ServerPager } from './UI';
import RecordForm, { type FormKind } from './RecordForm';
export default function Planning() {
  const { date, shortDate, zoneLabel } = usePlantTime();
  const { data, permissions, period } = useWorkspace();
  const [tab, setTab] = useState('assignments');
  const [search, setSearch] = useServerSearch();
  const [form, setForm] = useState<FormKind | null>(null);
  const canPlan = permissions.includes('plan');
  const assignments = data.assignments;
  return (
    <>
      <PageTitle
        eyebrow="OPERASIONAL / PERENCANAAN"
        title="Rencana & penugasan"
        description="Hubungkan target kerja, alat, dan personel dengan realisasi di lapangan."
        actions={
          canPlan && (
            <>
              <Button kind="secondary" onClick={() => setForm('plan')}>
                <Target size={16} />
                Rencana baru
              </Button>
              <Button kind="primary" onClick={() => setForm('assignment')}>
                <Plus size={17} />
                Buat penugasan
              </Button>
            </>
          )
        }
      />
      <div className="planning-summary">
        <div>
          <span className="metric-icon blue">
            <CalendarDays size={21} />
          </span>
          <span>
            <strong>{number(data.metrics.assignments)}</strong>
            <small>Penugasan periode ini</small>
          </span>
        </div>
        <div>
          <span className="metric-icon cyan">
            <Truck size={21} />
          </span>
          <span>
            <strong>{number(data.metrics.assigned_equipment)}</strong>
            <small>Alat ditugaskan</small>
          </span>
        </div>
        <div>
          <span className="metric-icon yellow">
            <Target size={21} />
          </span>
          <span>
            <strong>{number(data.metrics.plans)}</strong>
            <small>Rencana kerja</small>
          </span>
        </div>
      </div>
      <div className="tabs page-tabs">
        <button
          className={tab === 'assignments' ? 'active' : ''}
          onClick={() => setTab('assignments')}
        >
          Penugasan alat<span>{number(data.metrics.assignments)}</span>
        </button>
        <button className={tab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')}>
          Rencana & realisasi<span>{number(data.metrics.plans)}</span>
        </button>
      </div>
      {tab === 'assignments' ? (
        <Panel>
          <div className="table-toolbar">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari alat atau operator…"
            />
            <span className="muted small-text">Waktu penugasan ditampilkan dalam {zoneLabel}</span>
          </div>
          <DataTable
            rows={assignments}
            resource="assignments"
            keyOf={(a) => a.uuid}
            emptyTitle="Belum ada penugasan"
            emptyText="Susun jadwal alat dan operator untuk memulai pekerjaan."
            columns={[
              {
                label: 'Equipment',
                render: (a) => {
                  const e = data.equipment.find((e) => e.uuid === a.equipment_uuid);
                  return (
                    <div className="cell-stack">
                      <strong>{e?.name ?? '—'}</strong>
                      <small className="code">{e?.code}</small>
                    </div>
                  );
                },
              },
              {
                label: 'Operator / sopir',
                render: (a) => (
                  <span>{data.people.find((p) => p.uuid === a.operator_uuid)?.name ?? '—'}</span>
                ),
              },
              {
                label: 'Jadwal',
                render: (a) => (
                  <div className="cell-stack">
                    <strong>{shortDate(a.starts_at)}</strong>
                    <small>
                      {date(a.starts_at, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      –
                      {date(a.ends_at, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      {zoneLabel}
                    </small>
                  </div>
                ),
              },
              {
                label: 'Rencana terkait',
                render: (a) => (
                  <span>
                    {data.plans.find((p) => p.items.some((i) => i.uuid === a.plan_item_uuid))
                      ?.title ?? 'Ad hoc'}
                  </span>
                ),
              },
              { label: 'Status', render: (a) => <Badge value={a.status} /> },
            ]}
          />
        </Panel>
      ) : (
        <div className="plan-grid">
          {data.plans.map((plan) => (
            <Panel key={plan.uuid} title={plan.title} action={<Badge value={plan.status} />}>
              <div className="plan-meta">
                <CalendarDays size={14} />
                {shortDate(plan.starts_on)} – {shortDate(plan.ends_on)}
              </div>
              {plan.items.map((item) => {
                const actual =
                  item.actual == null || item.actual === '' ? null : Number(item.actual);
                const percent =
                  actual !== null && Number.isFinite(actual) && Number(item.target) > 0
                    ? (actual / Number(item.target)) * 100
                    : null;
                return (
                  <div className="plan-item" key={item.uuid}>
                    <div>
                      <strong>{item.description}</strong>
                      <small>
                        <MapPin size={12} />
                        {data.locations.find((l) => l.uuid === item.location_uuid)?.name ?? '—'}
                      </small>
                    </div>
                    <div className="plan-numbers">
                      <span>
                        <small>Target</small>
                        {number(item.target)} {item.unit}
                      </span>
                      <span>
                        <small>Realisasi final</small>
                        {number(actual)} {item.unit}
                      </span>
                    </div>
                    <div
                      className="progress-track"
                      aria-label={
                        percent === null
                          ? 'Realisasi belum tersedia'
                          : `Realisasi ${number(percent)} persen`
                      }
                    >
                      <i style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
                    </div>
                    <div className="progress-label">
                      <span>Hanya detail aktivitas tertaut dan satuan sebanding</span>
                      <strong>{percent === null ? 'Tidak tersedia' : `${number(percent)}%`}</strong>
                    </div>
                  </div>
                );
              })}
              {plan.notes && <p className="plan-note">{plan.notes}</p>}
            </Panel>
          ))}
          <ServerPager resource="plans" />
          {!data.plans.length && (
            <Panel>
              <Empty
                title="Belum ada rencana kerja"
                text="Tambahkan target berdasarkan pekerjaan, lokasi, periode, dan satuan."
              />
            </Panel>
          )}
        </div>
      )}
      {form && <RecordForm kind={form} onClose={() => setForm(null)} />}
    </>
  );
}
