import { usePlantTime } from '../lib/usePlantTime';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  BarChart3,
  CheckCheck,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Printer,
} from 'lucide-react';
import { useWorkspace, request, requestFile } from '../lib/workspace';
import { assertDocument } from '../lib/contracts';
import { number } from '../lib/types';
import { Button, Empty, ErrorNotice, Field, PageTitle, Panel, Select } from './UI';
export type ExportDocument = {
  title: string;
  subtitle: string;
  watermark: string | null;
  columns: string[];
  rows: (string | number | null)[][];
  total_rows?: number;
  sections: {
    total_rows?: number;
    title: string;
    columns: string[];
    rows: (string | number | null)[][];
  }[];
  notes: string[];
  summary: string[];
};
const formats = [
  ['vehicle', 'O-01', 'Buku kendaraan', 'Harian / mingguan · perjalanan, BBM, lembur'],
  ['heavy', 'O-02', 'Buku alat berat', 'Meter HM, lokasi, pekerjaan, operator & helper'],
  ['yanmar', 'O-03', 'Laporan mesin Yanmar', 'Sesi pagi/sore, solar, kumulatif & rasio'],
  ['genset', 'O-04', 'Laporan genset', 'Jam pemakaian, solar, pemanasan & pengesahan'],
  ['plan', 'O-05', 'Rencana & realisasi', 'Target, aktual, satuan & pencapaian'],
  ['meter', 'O-06', 'Rekap meter', 'Prestasi HM / KM / H per equipment'],
  ['fuel', 'O-07', 'Rekap bahan bakar', 'Pengisian, konsumsi & status verifikasi'],
  ['volume', 'O-08', 'Rekap volume', 'Pekerjaan × lokasi × satuan'],
  ['downtime', 'O-10', 'Downtime', 'Interval ketidaktersediaan alat'],
  ['maintenance', 'O-11', 'Riwayat perawatan', 'Tindakan, teknisi, part & rilis'],
  ['personnel', 'O-13', 'Riwayat personel', 'Aktivitas, alat & lembur'],
  ['quality', 'O-16', 'Kualitas data', 'Provenance impor & isu per baris'],
];
export default function ExportsPage() {
  const { date } = usePlantTime();
  const { data, period, notify, plantUuid } = useWorkspace();
  const [format, setFormat] = useState('vehicle');
  const [equipment, setEquipment] = useState('');
  const [operator, setOperator] = useState('');
  const loadVersion = useRef(0);
  useEffect(() => {
    setEquipment('');
    setOperator('');
  }, [plantUuid]);
  const [status, setStatus] = useState('approved');
  const [start, setStart] = useState(`${period}-01`);
  const [end, setEnd] = useState(
    `${period}-${new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate()}`,
  );
  const [document, setDocument] = useState<ExportDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [download, setDownload] = useState('');
  const [error, setError] = useState<unknown>(null);
  const body = () => ({
    format,
    equipment_uuid: equipment || null,
    operator_uuid: operator || null,
    status,
    start_date: start,
    end_date: end,
    plant_uuid: plantUuid,
  });
  useEffect(() => {
    setStart(`${period}-01`);
    setEnd(
      `${period}-${new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate()}`,
    );
  }, [period]);
  async function load() {
    const version = ++loadVersion.current;
    setBusy(true);
    setDocument(null);
    setError(null);
    try {
      const doc = await request<ExportDocument>('/workspace/report-preview', body());
      assertDocument(doc);
      if (version === loadVersion.current) setDocument(doc);
    } catch (e) {
      if (version === loadVersion.current) setError(e);
    } finally {
      if (version === loadVersion.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [format, equipment, operator, status, start, end, data, plantUuid]);
  async function exportFile(type: 'pdf' | 'xlsx') {
    if (download || busy) return;
    setDownload(type);
    setError(null);
    try {
      const blob = await requestFile('/workspace/export', { ...body(), output: type }, type);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `EPITA-${format}-${start}-${status}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
      notify(`Berkas laporan ${type.toUpperCase()} siap diunduh.`);
    } catch (e) {
      setError(e);
    } finally {
      setDownload('');
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="LAPORAN / DOKUMEN OPERASIONAL"
        title="Pusat laporan"
        description="Pilih format, tinjau data, lalu ekspor dengan perhitungan dan filter yang sama."
      />
      <div className="export-layout">
        <aside className="report-format-list">
          <span className="eyebrow">FORMAT LAPORAN</span>
          {formats.map(([key, id, title, description]) => (
            <button
              key={key}
              className={format === key ? 'active' : ''}
              onClick={() => setFormat(key)}
            >
              <span>
                <FileText size={18} />
              </span>
              <div>
                <small>{id}</small>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
              {format === key && <CheckCheck size={15} />}
            </button>
          ))}
        </aside>
        <div>
          <Panel
            title="Pengaturan laporan"
            description="Gunakan cakupan dan periode data yang sebanding."
          >
            <div className="export-filters">
              <Field label="Tanggal mulai">
                <input
                  type="date"
                  value={start}
                  onInput={(e) => setStart(e.currentTarget.value)}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </Field>
              <Field label="Tanggal akhir">
                <input
                  type="date"
                  min={start}
                  value={end}
                  onInput={(e) => setEnd(e.currentTarget.value)}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </Field>
              <Field label="Equipment">
                <Select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
                  <option value="">Semua equipment</option>
                  {data.equipment.map((e) => (
                    <option key={e.uuid} value={e.uuid}>
                      {e.code} · {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Operator / sopir">
                <Select value={operator} onChange={(e) => setOperator(e.target.value)}>
                  <option value="">Semua operator / sopir</option>
                  {data.people
                    .filter((person) => ['operator', 'driver'].includes(person.type))
                    .map((person) => (
                      <option key={person.uuid} value={person.uuid}>
                        {person.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Status data">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="approved">Final · disetujui</option>
                  <option value="all">Semua status · belum diverifikasi</option>
                </Select>
              </Field>
            </div>
            <div className="export-action-row">
              <span>
                <FileSpreadsheet size={15} />
                Angka, tanggal, dan kode disimpan sesuai tipe data.
              </span>
              <div>
                <Button
                  kind="secondary small"
                  disabled={!!download || busy}
                  onClick={() => void exportFile('xlsx')}
                >
                  {download === 'xlsx' ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <FileSpreadsheet size={15} />
                  )}
                  Excel
                </Button>
                <Button
                  kind="primary small"
                  disabled={!!download || busy}
                  onClick={() => void exportFile('pdf')}
                >
                  {download === 'pdf' ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  PDF
                </Button>
              </div>
            </div>
          </Panel>
          <ErrorNotice error={error} onRetry={() => void load()} />
          <div className="report-preview-heading">
            <h2>Pratinjau dokumen</h2>
            <span>
              {busy
                ? 'Memperbarui…'
                : document
                  ? `${document.rows.length} dari ${document.total_rows ?? document.rows.length} baris detail · ekspor memuat seluruh hasil`
                  : 'Belum tersedia'}
            </span>
          </div>
          {document ? (
            <div className={`report-paper ${busy ? 'loading' : ''}`}>
              <div className="paper-header">
                <div className="brand-mark small">
                  E<span />
                </div>
                <div>
                  <strong>EPITA</strong>
                  <small>DOKUMEN OPERASIONAL</small>
                </div>
                <span>{formats.find((f) => f[0] === format)?.[1]}</span>
              </div>
              <h2>{document.title}</h2>
              <p className="paper-subtitle">{document.subtitle}</p>
              {document.watermark && <div className="paper-watermark">{document.watermark}</div>}
              <div className="print-table-wrap">
                <table className="print-table">
                  <thead>
                    <tr>
                      {document.columns.map((c, i) => (
                        <th key={i}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {document.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((c, j) => (
                          <td key={j}>
                            {c === null || c === ''
                              ? '—'
                              : typeof c === 'number'
                                ? number(c, 3)
                                : c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!document.rows.length && (
                  <div className="paper-empty">Tidak ada data pada filter ini.</div>
                )}
              </div>
              {document.summary.length > 0 && (
                <div className="paper-summary">
                  {document.summary.map((s, i) => (
                    <span key={i}>{s}</span>
                  ))}
                </div>
              )}
              {document.sections.map((section, i) => (
                <div className="paper-section" key={i}>
                  <h3>{section.title}</h3>
                  {(section.total_rows ?? section.rows.length) > section.rows.length && (
                    <p className="muted">
                      Menampilkan {section.rows.length} dari {section.total_rows} baris. Ekspor
                      memuat seluruh hasil.
                    </p>
                  )}
                  <div className="print-table-wrap">
                    <table className="print-table">
                      <thead>
                        <tr>
                          {section.columns.map((c, j) => (
                            <th key={j}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((r, j) => (
                          <tr key={j}>
                            {r.map((c, k) => (
                              <td key={k}>
                                {c === null || c === ''
                                  ? '—'
                                  : typeof c === 'number'
                                    ? number(c, 3)
                                    : c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!section.rows.length && <p className="paper-empty">Tidak ada catatan.</p>}
                  </div>
                </div>
              ))}
              <div className="paper-signatures">
                <div>
                  Dibuat oleh
                  <span />
                  <strong>Nama / jabatan / tanggal</strong>
                </div>
                <div>
                  Diperiksa oleh
                  <span />
                  <strong>Nama / jabatan / tanggal</strong>
                </div>
                <div>
                  Disetujui oleh
                  <span />
                  <strong>Nama / jabatan / tanggal</strong>
                </div>
              </div>
              <div className="paper-notes">
                {document.notes.map((n, i) => (
                  <p key={i}>• {n}</p>
                ))}
              </div>
              <div className="paper-footer">
                <span>EPITA · Sumber sesuai filter</span>
                <span>Format memerlukan pengesahan pemilik proses.</span>
              </div>
            </div>
          ) : (
            !busy && (
              <Panel>
                <Empty
                  title="Pratinjau belum tersedia"
                  text="Periksa filter atau coba muat ulang laporan."
                />
              </Panel>
            )
          )}
        </div>
      </div>
    </>
  );
}
