import { usePlantTime } from '../lib/usePlantTime';
import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileSpreadsheet,
  FileUp,
  GitCompareArrows,
  LoaderCircle,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { request, useWorkspace, ActionError, useUnsavedChanges } from '../lib/workspace';
import { assertImport } from '../lib/contracts';
import { type ImportBatch, labels, number } from '../lib/types';
import {
  Badge,
  Button,
  DataTable,
  Empty,
  ErrorNotice,
  Field,
  Modal,
  PageTitle,
  Panel,
  Select,
} from './UI';
export default function IntegrationsPage() {
  const { date } = usePlantTime();
  const { data, plantUuid, addImport, notify, permissions } = useWorkspace();
  const [tab, setTab] = useState('imports');
  const [upload, setUpload] = useState(false);
  const [kind, setKind] = useState('iw47');
  const [system, setSystem] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<ImportBatch | null>(null);
  const [rowFilter, setRowFilter] = useState('');
  const inspected = selected
    ? (data.imports.find((batch) => batch.uuid === selected.uuid) ?? selected)
    : null;
  const mayClose = useUnsavedChanges({ kind, system, file: file?.name ?? '' }, busy, upload);
  const fieldErrors = error instanceof ActionError ? error.errors : {};
  const closeUpload = () => {
    if (mayClose()) setUpload(false);
  };
  useEffect(() => {
    if (!data.imports.some((batch) => ['queued', 'processing'].includes(batch.status))) return;
    const timer = setInterval(() => router.reload({ only: ['snapshot'] }), 4000);
    return () => clearInterval(timer);
  }, [data.imports]);
  async function inspect(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !file || !permissions.includes('import')) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      body.append('sap_system', system);
      body.append('plant_uuid', plantUuid);
      const result = await request<ImportBatch>('/workspace/import', body);
      assertImport(result);
      addImport(result);
      setUpload(false);
      setSelected(result);
      notify(
        ['queued', 'processing'].includes(result.status)
          ? 'File diterima untuk diproses.'
          : 'Sumber tersedia untuk diperiksa.',
      );
      setFile(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="INTEGRASI / KUALITAS DATA"
        title="Impor & rekonsiliasi"
        description="Pertahankan sumber, periksa mapping, dan telusuri setiap perbedaan data."
        actions={
          <Button
            kind="primary"
            disabled={!permissions.includes('import')}
            onClick={() => setUpload(true)}
          >
            <Upload size={17} />
            Impor workbook
          </Button>
        }
      />
      <div className="integration-flow">
        {[
          ['01', 'Unggah sumber'],
          ['02', 'Staging & validasi'],
          ['03', 'Mapping & pemeriksaan'],
          ['04', 'Rekonsiliasi'],
        ].map(([n, title], i) => (
          <div key={n}>
            <span>{n}</span>
            <strong>{title}</strong>
            {i < 3 && <ArrowRight size={16} />}
          </div>
        ))}
      </div>
      <div className="tabs page-tabs">
        <button className={tab === 'imports' ? 'active' : ''} onClick={() => setTab('imports')}>
          Riwayat impor<span>{number(data.pagination?.imports?.total)}</span>
        </button>
        <button
          className={tab === 'reconciliation' ? 'active' : ''}
          onClick={() => setTab('reconciliation')}
        >
          Rekonsiliasi IW47
        </button>
        <button className={tab === 'mapping' ? 'active' : ''} onClick={() => setTab('mapping')}>
          Mapping & keputusan
        </button>
      </div>
      {tab === 'imports' && (
        <Panel
          title="Sumber & antrean pemeriksaan"
          description="Impor sumber tidak otomatis menyetujui laporan lapangan."
        >
          <DataTable
            rows={data.imports}
            resource="imports"
            keyOf={(b) => b.uuid}
            onRow={setSelected}
            emptyTitle="Belum ada workbook diimpor"
            emptyText="Unggah Excel harian atau ekspor IW47 untuk memeriksa header, baris, dan masalah data."
            columns={[
              {
                label: 'File sumber',
                render: (b) => (
                  <div className="cell-identity">
                    <span className="file-avatar">
                      <FileSpreadsheet size={21} />
                    </span>
                    <span>
                      <strong>{b.filename}</strong>
                      <small>
                        {b.kind === 'iw47' ? 'SAP IW47' : 'Laporan harian'} · {date(b.created_at)}
                      </small>
                    </span>
                  </div>
                ),
              },
              { label: 'Baris staging', render: (b) => <span>{number(b.rows_count)} baris</span> },
              { label: 'Status', render: (b) => <Badge value={b.status} /> },
              {
                label: '',
                render: (b) => (
                  <button
                    className="text-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(b);
                    }}
                  >
                    Periksa sumber
                    <ArrowRight size={14} />
                  </button>
                ),
              },
            ]}
          />
        </Panel>
      )}
      {tab === 'reconciliation' && (
        <Panel>
          <Empty
            icon={<GitCompareArrows size={29} />}
            title="Rekonsiliasi menunggu sumber terverifikasi"
            text="Diperlukan mapping identitas, penyelesaian pembatalan SAP, dan laporan final dalam periode yang sebanding. Data Agustus dan September tidak dipaksa cocok."
            action={
              <Button kind="secondary" onClick={() => setUpload(true)}>
                <FileUp size={16} />
                Unggah sumber IW47
              </Button>
            }
          />
          <div className="reconciliation-rules">
            <div>
              <ShieldCheck size={18} />
              <strong>Actual work ≠ quantity</strong>
              <p>Prestasi dan volume diperiksa terpisah dengan satuannya masing-masing.</p>
            </div>
            <div>
              <AlertTriangle size={18} />
              <strong>Pembatalan tetap ditelusuri</strong>
              <p>Nilai Cancelled Confirm. disimpan mentah sampai aturan reversal disahkan.</p>
            </div>
          </div>
        </Panel>
      )}
      {tab === 'mapping' && (
        <Panel
          title="Keputusan yang memerlukan pengesahan"
          description="Data berikut diperlakukan sebagai kandidat, bukan fakta master yang otomatis disetujui."
        >
          <div className="decision-list">
            {[
              [
                'Identitas equipment',
                'Kode ganda antar-sheet, kode kosong, dan mapping equipment harus ditinjau terhadap plant, serial, dan identitas sah.',
              ],
              [
                'Personel & lokasi',
                'Kode personel, lokasi nonblok, reason pekerjaan, dan operation SAP dipetakan secara eksplisit.',
              ],
              [
                'Satuan actual work',
                'HM, KM, dan H tetap terpisah. Unit quantity tidak menggantikan unit actual work.',
              ],
              [
                'Pembatalan SAP',
                'Hubungan confirmation, counter, cancellation, dan reversal memerlukan contoh yang disahkan pemilik SAP.',
              ],
              [
                'Periode & tanggal',
                'Work date, execution timestamps, dan Posting Date tetap disimpan terpisah.',
              ],
              ['Integrasi MM', 'Approval EPITA tidak berarti material sudah diposting ke SAP.'],
            ].map(([title, text]) => (
              <div key={title}>
                <span className="decision-marker" />
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
                <Badge value="unverified">Perlu pengesahan</Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {upload && (
        <Modal
          title="Impor workbook sumber"
          description={'File disimpan privat dan diproses melalui antrean Laravel.'}
          onClose={closeUpload}
        >
          <form onSubmit={inspect}>
            <ErrorNotice error={error} />
            <div className="form-grid">
              <Field label="Jenis sumber" error={fieldErrors.kind}>
                <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="iw47">Ekspor SAP IW47</option>
                  <option value="daily">Laporan harian alat berat</option>
                </Select>
              </Field>
              {kind === 'iw47' && (
                <Field
                  label="Sistem / client SAP"
                  error={fieldErrors.sap_system}
                  hint="Identitas ini menjadi bagian dari unique key konfirmasi."
                >
                  <input
                    required
                    value={system}
                    onChange={(e) => setSystem(e.target.value)}
                    placeholder="Contoh: ERP / client yang sah"
                  />
                </Field>
              )}
              <Field
                label="File workbook"
                className="span-2"
                error={fieldErrors.file}
                hint="Excel atau CSV, maksimal 10 MB."
              >
                <input
                  required
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
            <div className="notice">
              Seluruh kolom mentah dipertahankan. Subtotal, total, dan baris kosong tidak diposting
              sebagai detail operasional.
            </div>
            <div className="form-actions">
              <Button type="button" kind="secondary" onClick={closeUpload} disabled={busy}>
                Batal
              </Button>
              <Button kind="primary" disabled={busy}>
                {busy ? <LoaderCircle size={16} className="spin" /> : <FileUp size={16} />}{' '}
                {busy ? 'Memeriksa sumber…' : 'Unggah & periksa'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {inspected && (
        <Modal
          title="Pemeriksaan sumber"
          description={`${inspected.filename} · ${number(inspected.rows_count)} baris staging`}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="notice">
            Status sumber: BELUM DIVERIFIKASI. Pemeriksaan tidak membuat master equipment, laporan
            final, atau posting SAP.
          </div>
          {inspected.error && <div className="error-notice">{inspected.error}</div>}
          <div className="table-toolbar">
            <Field label="Klasifikasi">
              <Select value={rowFilter} onChange={(e) => setRowFilter(e.target.value)}>
                <option value="">Semua baris</option>
                <option value="detail">Detail</option>
                <option value="subtotal">Subtotal / total</option>
                <option value="needs_review">Perlu pemeriksaan</option>
              </Select>
            </Field>
          </div>
          <DataTable
            rows={(inspected.rows ?? []).filter(
              (r) => !rowFilter || r.classification === rowFilter,
            )}
            keyOf={(r) => `${r.sheet}-${r.row_number}`}
            initialPageSize={8}
            emptyTitle={
              inspected.status === 'queued'
                ? 'File sedang menunggu worker'
                : 'Tidak ada baris pada filter ini'
            }
            columns={[
              {
                label: 'Sumber',
                render: (r) => (
                  <div className="cell-stack">
                    <strong>{r.sheet}</strong>
                    <small>Baris {r.row_number}</small>
                  </div>
                ),
              },
              {
                label: 'Klasifikasi',
                render: (r) => (
                  <Badge value={r.classification}>
                    {r.classification === 'detail'
                      ? 'Detail'
                      : r.classification === 'subtotal'
                        ? 'Subtotal / total'
                        : 'Perlu pemeriksaan'}
                  </Badge>
                ),
              },
              {
                label: 'Nilai normalisasi',
                render: (r) => (
                  <div className="cell-stack small-text">
                    {Object.entries(r.normalized ?? {})
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <span key={k}>
                          <strong>{k}:</strong> {String(v ?? '—')}
                        </span>
                      ))}
                  </div>
                ),
              },
              {
                label: 'Masalah / tindak lanjut',
                render: (r) => (
                  <span className="small-text">
                    {r.issues?.join(' · ') ||
                      'Tidak ada masalah struktural; mapping tetap perlu disahkan.'}
                  </span>
                ),
              },
            ]}
          />
        </Modal>
      )}
    </>
  );
}
