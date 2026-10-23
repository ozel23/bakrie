import { usePlantTime } from '../lib/usePlantTime';
import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CircleHelp, Droplets, ShieldCheck } from 'lucide-react';
import { useServerSearch, useWorkspace } from '../lib/workspace';
import { type Report, type Fuel, labels, number } from '../lib/types';
import { Badge, Button, DataTable, PageTitle, Panel, SearchInput, Select } from './UI';
export default function FuelPage({
  onVerify,
  onReport,
}: {
  onVerify: (r: Report, f: Fuel) => void;
  onReport: (r: Report) => void;
}) {
  const { shortDate } = usePlantTime();
  const { data, period, permissions, filters, filter } = useWorkspace();
  const meaning = filters.meaning ?? '';
  const setMeaning = (meaning: string) => filter({ meaning, fuel_page: 1 });
  const [search, setSearch] = useServerSearch();
  const rows = data.reports
    .filter((r) => r.work_date.startsWith(period))
    .flatMap((r) =>
      r.fuel_events.map((f) => ({
        report: r,
        fuel: f,
        equipment: data.equipment.find((e) => e.uuid === r.equipment_uuid),
      })),
    );
  const sum = (meaning: string) =>
    meaning === 'receipt' ? data.metrics.receipt_liters : data.metrics.consumption_liters;
  const filtered = rows.filter((row) => data.fuel_page_uuids?.includes(row.fuel.uuid));

  return (
    <>
      <PageTitle
        eyebrow="BAHAN BAKAR / PENGENDALIAN"
        title="Bahan bakar & pelumas"
        description="Pisahkan penerimaan, konsumsi, dan nilai yang masih memerlukan konfirmasi."
      />
      <div className="fuel-metrics">
        <div>
          <span className="metric-icon blue">
            <ArrowDownLeft size={22} />
          </span>
          <div>
            <small>Pengisian terverifikasi</small>
            <strong>
              {number(sum('receipt'))}
              <span>liter</span>
            </strong>
          </div>
        </div>
        <div>
          <span className="metric-icon cyan">
            <Droplets size={22} />
          </span>
          <div>
            <small>Konsumsi terverifikasi</small>
            <strong>
              {number(sum('consumption'))}
              <span>liter</span>
            </strong>
          </div>
        </div>
        <div>
          <span className="metric-icon yellow">
            <ShieldCheck size={22} />
          </span>
          <div>
            <small>Perlu pemeriksaan</small>
            <strong>
              {data.metrics.fuel_pending}
              <span>catatan</span>
            </strong>
          </div>
        </div>
      </div>
      <div className="notice fuel-notice">
        <CircleHelp size={18} />
        <div>
          <strong>Satu catatan, satu makna.</strong> Pengisian bukan konsumsi. Rekap final hanya
          memuat catatan terverifikasi dari laporan disetujui. Posting SAP MM memerlukan integrasi
          dan acknowledgement tersendiri.
        </div>
      </div>
      <Panel>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari equipment atau jenis BBM…"
          />
          <Select
            aria-label="Filter makna BBM"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
          >
            <option value="">Semua catatan</option>
            <option value="unverified">Perlu pemeriksaan</option>
            <option value="receipt">Pengisian</option>
            <option value="consumption">Konsumsi</option>
          </Select>
        </div>
        <DataTable
          rows={filtered}
          resource="fuel"
          keyOf={(x) => x.fuel.uuid}
          emptyTitle="Tidak ada catatan BBM pada filter ini"
          columns={[
            {
              label: 'Tanggal / equipment',
              render: (x) => (
                <div className="cell-stack">
                  <strong>{x.equipment?.name ?? '—'}</strong>
                  <small>
                    {shortDate(x.report.work_date)} · {x.equipment?.code}
                  </small>
                </div>
              ),
            },
            {
              label: 'Jenis / metode',
              render: (x) => (
                <div className="cell-stack">
                  <span>{x.fuel.fuel_type}</span>
                  <small>{labels[x.fuel.method]}</small>
                </div>
              ),
            },
            {
              label: 'Kuantitas',
              render: (x) => (
                <span className="meter-value">
                  {number(x.fuel.quantity)} <small>{x.fuel.unit}</small>
                </span>
              ),
            },
            {
              label: 'Makna / verifikasi',
              render: (x) => (
                <div className="cell-stack">
                  <Badge value={x.fuel.verified_at ? x.fuel.meaning : 'unverified'} />
                  {x.fuel.meaning !== 'unverified' && !x.fuel.verified_at && (
                    <small>Dinyatakan: {labels[x.fuel.meaning]}</small>
                  )}
                </div>
              ),
            },
            {
              label: 'SAP MM',
              render: () => <span className="muted small-text">Belum disiapkan</span>,
            },
            {
              label: 'Tindakan',
              render: (x) =>
                permissions.includes('fuel-verify') &&
                ['submitted', 'reviewed'].includes(x.report.status) ? (
                  <Button kind="secondary small" onClick={() => onVerify(x.report, x.fuel)}>
                    Verifikasi
                    <ArrowUpRight size={13} />
                  </Button>
                ) : (
                  <button className="text-button" onClick={() => onReport(x.report)}>
                    Lihat laporan
                    <ArrowUpRight size={13} />
                  </button>
                ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
