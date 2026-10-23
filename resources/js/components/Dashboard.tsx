import { usePlantTime } from '../lib/usePlantTime';
import { Link } from '@inertiajs/react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Droplets,
  FilePlus2,
  HardHat,
  Plus,
  Truck,
  Wrench,
  Activity as ActivityIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from 'recharts';
import { useState } from 'react';
import { useWorkspace } from '../lib/workspace';
import { labels, number, type Report } from '../lib/types';
import { Badge, Button, Empty, Panel } from './UI';
export default function Dashboard({
  base,
  onNewReport,
  onReport,
  onBreakdown,
}: {
  base: string;
  onNewReport: () => void;
  onReport: (report: Report) => void;
  onBreakdown: () => void;
}) {
  const { date, shortDate, today, timeZone } = usePlantTime();
  const { data, period, permissions, plantUuid } = useWorkspace();
  const [unit, setUnit] = useState('HM');
  const reports = data.reports.filter((r) => r.work_date.startsWith(period));
  const approved = reports.filter((r) => r.status === 'approved');
  const waiting = reports.filter((r) => ['submitted', 'reviewed'].includes(r.status));
  const active = data.equipment.filter((e) => e.active);
  const metrics = data.metrics;
  const totalMeter = (unit: string) => metrics.meter[unit];
  const consumption = metrics.consumption_liters;
  const fuelPending = metrics.fuel_pending;
  const waitingCount =
    (metrics.report_counts.submitted ?? 0) + (metrics.report_counts.reviewed ?? 0);
  const conditions = [
    { key: 'working', color: '#0A4667' },
    { key: 'standby', color: '#89C7E7' },
    { key: 'maintenance', color: '#FFD301' },
    { key: 'breakdown', color: '#E98B7A' },
    { key: 'unknown', color: '#dbe3e8' },
  ]
    .map((x) => ({ ...x, value: metrics.equipment_conditions[x.key] ?? 0 }))
    .filter((x) => x.value > 0);
  const lastDay = Math.min(
    period === today().slice(0, 7)
      ? Number(today().slice(8))
      : new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate(),
    31,
  );
  const trend = Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1;
    const key = `${period}-${String(day).padStart(2, '0')}`;
    const daily = metrics.trend.find((row) => row.date === key && row.unit === unit);
    return {
      name: String(day).padStart(2, '0'),
      value: daily?.total == null ? null : Number(daily.total),
    };
  });
  const hasTrend = trend.some((d) => d.value !== null);
  const openOrders = data.orders.filter((o) => o.status !== 'released');
  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <div className="welcome-eyebrow">
            <span className="live-dot" /> RUANG KENDALI OPERASIONAL
          </div>
          <h1>
            Operasional dalam satu pandangan<span>.</span>
          </h1>
          <p>Pantau armada, tindak lanjuti laporan, dan jaga pekerjaan tetap bergerak.</p>
        </div>
        <div className="welcome-actions">
          {permissions.some((p) => p === 'report-delegate' || p === 'report-own') && (
            <Button kind="primary" onClick={onNewReport}>
              <Plus size={17} /> Laporan baru
            </Button>
          )}
          <span>
            <CalendarDays size={14} />
            {new Intl.DateTimeFormat('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone,
            }).format(new Date())}
          </span>
        </div>
        <div className="welcome-decoration" aria-hidden="true">
          <Truck />
          <div />
          <div />
        </div>
      </div>
      <div className="metric-grid">
        <Link
          href={`${base}/equipment?plant=${plantUuid}&period=${period}`}
          className="metric-card"
        >
          <div className="metric-head">
            <span>Total alat aktif</span>
            <span className="metric-icon blue">
              <Truck size={19} />
            </span>
          </div>
          <div className="metric-number">
            {number(metrics.active_equipment)}
            <small>unit</small>
          </div>
          <div className="metric-foot">
            <span className="metric-dot" /> {metrics.equipment_conditions.working ?? 0} unit sedang
            bekerja <ArrowUpRight size={15} />
          </div>
        </Link>
        <Link href={`${base}/reports?plant=${plantUuid}&period=${period}`} className="metric-card">
          <div className="metric-head">
            <span>Prestasi operasional</span>
            <span className="metric-icon cyan">
              <ActivityIcon size={19} />
            </span>
          </div>
          <div className="metric-number">
            {number(totalMeter('HM'))}
            <small>HM</small>
          </div>
          <div className="metric-foot">
            <span>
              {number(totalMeter('KM'))} KM <b>·</b> {number(totalMeter('H'))} H
            </span>
            <span className="mini-label">Disetujui</span>
          </div>
        </Link>
        <Link href={`${base}/fuel?plant=${plantUuid}&period=${period}`} className="metric-card">
          <div className="metric-head">
            <span>Konsumsi terverifikasi</span>
            <span className="metric-icon purple">
              <Droplets size={19} />
            </span>
          </div>
          <div className="metric-number">
            {number(consumption)}
            <small>liter</small>
          </div>
          <div className="metric-foot">
            <span>{fuelPending} catatan perlu verifikasi</span>
            <ArrowUpRight size={15} />
          </div>
        </Link>
        <Link
          href={`${base}/${permissions.includes('approve') ? 'approvals' : 'reports'}?plant=${plantUuid}&period=${period}`}
          className="metric-card metric-attention"
        >
          <div className="metric-head">
            <span>Menunggu pemeriksaan</span>
            <span className="metric-icon yellow">
              <ClipboardCheck size={19} />
            </span>
          </div>
          <div className="metric-number">
            {number(waitingCount)}
            <small>laporan</small>
          </div>
          <div className="metric-foot">
            <span>
              {permissions.includes('approve') ? 'Lihat antrean persetujuan' : 'Telusuri laporan'}
            </span>
            <ArrowRight size={15} />
          </div>
        </Link>
      </div>
      <div className="dashboard-charts">
        <Panel
          title="Tren aktivitas operasional"
          description="Prestasi dari laporan yang telah disetujui"
          action={
            <div className="segmented compact">
              {['HM', 'KM', 'H'].map((u) => (
                <button key={u} className={u === unit ? 'active' : ''} onClick={() => setUnit(u)}>
                  {u}
                </button>
              ))}
            </div>
          }
        >
          <div className="chart-summary">
            <strong>
              {number(totalMeter(unit))}
              <span>{unit}</span>
            </strong>
            <span>
              <i />
              Total prestasi periode ini
            </span>
            <span className="chart-source">Laporan final</span>
          </div>
          {hasTrend ? (
            <div className="trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 15, right: 12, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#89C7E7" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#89C7E7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e6edf1" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#82929f', fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#82929f', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => [`${number(Number(v))} ${unit}`, 'Prestasi']}
                    labelFormatter={(v) => `Tanggal ${v}`}
                    contentStyle={{ border: '1px solid #e2eaf0', borderRadius: 10, fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2786AF"
                    strokeWidth={2.5}
                    fill="url(#activity-fill)"
                    dot={{ r: 3, strokeWidth: 1, fill: '#fff' }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              title={`Belum ada prestasi ${unit}`}
              text="Grafik akan terisi setelah laporan disetujui pada periode ini."
            />
          )}
          <div className="chart-caption">
            <CircleHelp size={13} /> HM adalah selisih meter. Durasi kerja dihitung terpisah dari
            waktu aktivitas.
          </div>
        </Panel>
        <Panel
          title="Kondisi armada"
          description="Status terakhir yang telah dikonfirmasi"
          action={
            <Link
              className="icon-button"
              aria-label="Lihat seluruh alat"
              href={`${base}/equipment?plant=${plantUuid}&period=${period}`}
            >
              <ArrowUpRight size={18} />
            </Link>
          }
        >
          <div className="fleet-donut">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={conditions.length ? conditions : [{ value: 1, color: '#edf2f5' }]}
                  dataKey="value"
                  innerRadius={65}
                  outerRadius={82}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={conditions.length > 1 ? 4 : 0}
                  stroke="none"
                >
                  {(conditions.length ? conditions : [{ key: 'empty', color: '#edf2f5' }]).map(
                    (x) => (
                      <Cell key={x.key} fill={x.color} />
                    ),
                  )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              <strong>{metrics.active_equipment}</strong>
              <span>total unit aktif</span>
            </div>
          </div>
          <div className="condition-legend">
            {conditions.map((c) => (
              <div key={c.key}>
                <span>
                  <i style={{ background: c.color }} />
                  {labels[c.key]}
                </span>
                <strong>
                  {c.value}
                  <small>unit</small>
                </strong>
              </div>
            ))}
          </div>
          <div className="status-note">
            <Clock3 size={13} /> Kondisi terkini; tidak mengikuti filter periode laporan.
          </div>
        </Panel>
      </div>
      <div className="dashboard-bottom">
        <Panel
          title={
            <>
              <span className="heading-icon">
                <ClipboardCheck size={17} />
              </span>
              Perlu ditindaklanjuti <span className="count-pill">{waitingCount}</span>
            </>
          }
          description={
            permissions.includes('approve')
              ? 'Laporan yang menunggu pemeriksaan Anda'
              : 'Laporan yang masih menunggu pemeriksaan'
          }
          action={
            <Link
              className="text-link"
              href={`${base}/${permissions.includes('approve') ? 'approvals' : 'reports'}?plant=${plantUuid}&period=${period}`}
            >
              Lihat semua <ArrowRight size={14} />
            </Link>
          }
        >
          {waiting.length ? (
            <div className="approval-list">
              {waiting.slice(0, 4).map((r) => {
                const eq = data.equipment.find((e) => e.uuid === r.equipment_uuid);
                const op = data.people.find((p) => p.uuid === r.operator_uuid);
                return (
                  <button key={r.uuid} className="approval-row" onClick={() => onReport(r)}>
                    <span
                      className={`equipment-avatar ${eq?.category === 'vehicle' ? 'vehicle' : ''}`}
                    >
                      {eq?.category === 'vehicle' ? <Truck size={21} /> : <HardHat size={21} />}
                    </span>
                    <span className="approval-identity">
                      <strong>{eq?.name ?? 'Equipment'}</strong>
                      <small>
                        {eq?.code} <b>·</b> {op?.name}
                      </small>
                    </span>
                    <span className="approval-date">
                      {shortDate(r.work_date)}
                      <small>{r.shift}</small>
                    </span>
                    <span className="approval-meter">
                      {number(r.meter_delta)}
                      <small>{r.meter_unit}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title="Antrean sudah bersih"
              text="Tidak ada laporan yang menunggu pemeriksaan pada periode ini."
              icon={<CheckCheck size={27} />}
            />
          )}
        </Panel>
        <Panel title="Pusat perhatian" description="Prioritas untuk menjaga alat tetap siap">
          <div className="attention-card">
            <div className="attention-icon orange">
              <Wrench size={19} />
            </div>
            <div>
              <strong>{metrics.open_breakdowns} kerusakan terbuka</strong>
              <p>Periksa prioritas dan tindak lanjut perbaikan.</p>
              <Link href={`${base}/maintenance?plant=${plantUuid}&period=${period}`}>
                Buka perawatan <ArrowRight size={13} />
              </Link>
            </div>
          </div>
          <div className="attention-card">
            <div className="attention-icon blue">
              <Droplets size={19} />
            </div>
            <div>
              <strong>{fuelPending} catatan BBM belum diverifikasi</strong>
              <p>Pastikan pengisian dan konsumsi tercatat sesuai maknanya.</p>
              <Link href={`${base}/fuel?plant=${plantUuid}&period=${period}`}>
                Periksa catatan BBM <ArrowRight size={13} />
              </Link>
            </div>
          </div>
          <div className="attention-footer">
            <span>
              <span className="live-dot" />
              {metrics.active_orders} work order aktif
            </span>
            {permissions.includes('breakdown') && (
              <button className="text-button" onClick={onBreakdown}>
                Laporkan kerusakan <Plus size={13} />
              </button>
            )}
          </div>
        </Panel>
      </div>
      <div className="dashboard-note">
        <ShieldIcon />
        Angka operasional berasal dari laporan disetujui. BBM ambigu tidak dimasukkan ke konsumsi
        final.<span>EPITA OPERATIONS</span>
      </div>
    </>
  );
}
function ShieldIcon() {
  return <CheckCheck size={15} />;
}
