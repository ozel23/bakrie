import { Head, Link, router } from '@inertiajs/react';
import { type ReactNode, useEffect, useState, lazy, Suspense } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Command,
  Droplets,
  ExternalLink,
  FileBarChart2,
  FileText,
  Fuel,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  Truck,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from '../lib/workspace';
import {
  type WorkspaceProps,
  type Report,
  type Fuel as FuelRecord,
  labels,
  number,
} from '../lib/types';
import { Badge, Button, Empty, Modal, SearchInput } from '../components/UI';
const Dashboard = lazy(() => import('../components/Dashboard'));
import { EquipmentPage, MasterPage } from '../components/Catalog';
import Planning from '../components/Planning';
import { ReportsPage, ReportEditor, ReportDetail, FuelVerification } from '../components/Reports';
import FuelPage from '../components/Fuel';
import MaintenancePage from '../components/Maintenance';
import ExportsPage from '../components/Exports';
import IntegrationsPage from '../components/Integrations';
import RecordForm from '../components/RecordForm';
import ErrorPage from './Error';
import { isWorkspaceData, normalizeWorkspaceData } from '../lib/contracts';
import { validTimeZone } from '../lib/time';
import { usePlantTime } from '../lib/usePlantTime';
import { ActionError, responseError } from '../lib/http';
import { ErrorNotice } from '../components/UI';
type NavItem = { key: string; label: string; icon: typeof Truck; permission?: string[] };
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'RUANG KERJA',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'OPERASIONAL',
    items: [
      { key: 'planning', label: 'Rencana & penugasan', icon: Target, permission: ['plan', 'read'] },
      { key: 'reports', label: 'Laporan harian', icon: ClipboardList },
      {
        key: 'approvals',
        label: 'Persetujuan laporan',
        icon: ClipboardCheck,
        permission: ['approve'],
      },
    ],
  },
  {
    label: 'PENGENDALIAN',
    items: [
      {
        key: 'fuel',
        label: 'Bahan bakar',
        icon: Droplets,
        permission: ['fuel-verify', 'export', 'report-own'],
      },
      { key: 'maintenance', label: 'Perawatan & kerusakan', icon: Wrench },
    ],
  },
  {
    label: 'LAPORAN & INTEGRASI',
    items: [
      { key: 'exports', label: 'Pusat laporan', icon: FileBarChart2, permission: ['export'] },
      {
        key: 'integrations',
        label: 'Impor & rekonsiliasi',
        icon: Activity,
        permission: ['import'],
      },
    ],
  },
  {
    label: 'ADMINISTRASI',
    items: [
      { key: 'equipment', label: 'Master equipment', icon: Truck },
      { key: 'people', label: 'Personel', icon: Users },
      { key: 'locations', label: 'Lokasi', icon: MapPin },
    ],
  },
];
const pageNames: Record<string, string> = Object.fromEntries(
  navGroups.flatMap((g) => g.items.map((i) => [i.key, i.label])),
);
export default function Workspace(props: WorkspaceProps) {
  const snapshot = normalizeWorkspaceData(props.snapshot);
  const [toast, setToast] = useState<{ message: string; kind: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  if (
    !isWorkspaceData(snapshot) ||
    typeof props.auth?.name !== 'string' ||
    typeof props.plant?.uuid !== 'string' ||
    !validTimeZone(props.plant?.timezone) ||
    !Array.isArray(props.permissions) ||
    !props.permissions.every((permission) => typeof permission === 'string')
  ) {
    return <ErrorPage status={503} message="Data halaman belum dapat dimuat. Silakan coba lagi." />;
  }
  const screenProps = { ...props, snapshot };
  return (
    <WorkspaceProvider
      key={props.plant?.uuid}
      props={screenProps}
      onNotify={(message, kind = 'success') => setToast({ message, kind })}
    >
      <WorkspaceShell props={screenProps} />
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.kind === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button aria-label="Tutup pemberitahuan" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </WorkspaceProvider>
  );
}
function WorkspaceShell({ props }: { props: WorkspaceProps }) {
  const { date, zoneLabel } = usePlantTime();
  const { data, permissions, period, setPeriod } = useWorkspace();
  const base = '/app';
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [account, setAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  useEffect(() => {
    const start = router.on('start', () => {
      setLoading(true);
      setLoadError(null);
    });
    const finish = router.on('finish', () => setLoading(false));
    const network = router.on('networkError', (event) => {
      event.preventDefault();
      setLoadError(new ActionError('Data belum dapat dimuat. Silakan coba lagi.'));
    });
    const http = router.on('httpException', (event) => {
      event.preventDefault();
      const response = event.detail.response;
      const reference = response.headers['x-request-id'];
      setLoadError(
        responseError(
          response.status,
          response.data,
          typeof reference === 'string' ? reference : undefined,
        ),
      );
    });
    return () => {
      start();
      finish();
      network();
      http();
    };
  }, []);
  const [editor, setEditor] = useState<Report | true | null>(null);
  const [detail, setDetail] = useState<Report | null>(null);
  const [verification, setVerification] = useState<{ report: Report; fuel: FuelRecord } | null>(
    null,
  );
  const [breakdown, setBreakdown] = useState(false);
  const pending = data.reports.filter((r) => ['submitted', 'reviewed'].includes(r.status));
  const pendingCount =
    (data.metrics.report_counts.submitted ?? 0) + (data.metrics.report_counts.reviewed ?? 0);
  const page = props.page || 'dashboard';
  const currentName = pageNames[page] ?? 'Dashboard';
  const menu = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => !i.permission || i.permission.some((p) => permissions.includes(p)),
      ),
    }))
    .filter((g) => g.items.length);
  const openReport = (report: Report) => {
    setDetail(report);
    setNotifications(false);
    setSearchOpen(false);
  };
  useEffect(() => {
    setDrawer(false);
  }, [page]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setDrawer(false);
        setNotifications(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  let content: ReactNode;
  switch (page) {
    case 'equipment':
      content = <EquipmentPage onReport={openReport} />;
      break;
    case 'people':
    case 'locations':
      content = <MasterPage kind={page} />;
      break;
    case 'planning':
      content = <Planning />;
      break;
    case 'reports':
      content = <ReportsPage onNew={() => setEditor(true)} onOpen={openReport} />;
      break;
    case 'approvals':
      content = <ReportsPage approval onNew={() => setEditor(true)} onOpen={openReport} />;
      break;
    case 'fuel':
      content = (
        <FuelPage
          onVerify={(report, fuel) => setVerification({ report, fuel })}
          onReport={openReport}
        />
      );
      break;
    case 'maintenance':
      content = <MaintenancePage />;
      break;
    case 'exports':
      content = <ExportsPage />;
      break;
    case 'integrations':
      content = <IntegrationsPage />;
      break;
    default:
      content = (
        <Dashboard
          base={base}
          onNewReport={() => setEditor(true)}
          onReport={openReport}
          onBreakdown={() => setBreakdown(true)}
        />
      );
  }
  return (
    <>
      <Head title={currentName} />
      <a className="skip-link" href="#main-content">
        Langsung ke konten utama
      </a>
      {drawer && <div className="sidebar-scrim" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar ${drawer ? 'open' : ''}`}>
        <Link
          href={`${base}/dashboard?plant=${props.plant?.uuid ?? ''}&period=${period}`}
          className="brand"
        >
          <span className="brand-mark">
            E<span />
          </span>
          <span>
            EPITA<small>OPERATIONS PLATFORM</small>
          </span>
        </Link>
        <div className="workspace-badge">
          <span className="workspace-logo">
            <Truck size={16} />
          </span>
          <span>
            Equipment & Plant<small>Integrated Tracking</small>
          </span>
          <ShieldCheck size={14} />
        </div>
        <nav aria-label="Navigasi utama">
          {menu.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => (
                <Link
                  key={item.key}
                  className={`nav-item ${page === item.key ? 'active' : ''}`}
                  href={`${base}/${item.key}?plant=${props.plant?.uuid ?? ''}&period=${period}`}
                  aria-current={page === item.key ? 'page' : undefined}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.key === 'approvals' && pendingCount > 0 ? (
                    <span className="nav-count">{pendingCount}</span>
                  ) : page === item.key ? (
                    <span className="nav-active-dot" />
                  ) : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <ClipboardCheck size={19} />
            </span>
            <strong>
              Catat hari ini.
              <br />
              Kendalikan esok hari.
            </strong>
            <p>Data yang rapi dimulai dari satu laporan yang tepat.</p>
          </div>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            <span>Panduan & bantuan</span>
            <ExternalLink size={13} />
          </button>
          <div className="sidebar-version">
            EPITA <span>Ruang kerja</span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Buka navigasi"
              onClick={() => setDrawer(true)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumb">
              <span>Ruang kerja</span>
              <ChevronRight size={13} />
              <strong>{currentName}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <button className="header-search" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              <span>Cari di EPITA…</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="topbar-divider" />
            <div className="plant-switch">
              <span className="plant-indicator" />
              <select
                aria-label="Plant aktif"
                value={props.plant?.uuid ?? ''}
                onChange={(e) => router.get(`${base}/${page}`, { plant: e.target.value, period })}
              >
                {props.plants?.map((p) => (
                  <option key={p.uuid} value={p.uuid}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <div className="notification-wrap">
              <button
                className={`icon-button notification-button ${notifications ? 'selected' : ''}`}
                aria-label={`Pemberitahuan, ${pendingCount} laporan menunggu`}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {pendingCount > 0 && <i />}
              </button>
              {notifications && (
                <div className="notification-popover">
                  <div>
                    <strong>Perlu ditindaklanjuti</strong>
                    <span>{pendingCount} laporan</span>
                  </div>
                  {pending.slice(0, 4).map((r) => (
                    <button key={r.uuid} onClick={() => openReport(r)}>
                      <span className="metric-icon yellow">
                        <ClipboardCheck size={17} />
                      </span>
                      <span>
                        <strong>
                          {data.equipment.find((e) => e.uuid === r.equipment_uuid)?.name}
                        </strong>
                        <small>
                          {labels[r.status]} · {date(r.work_date)}
                        </small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                  {!pending.length && <Empty title="Tidak ada antrean" />}
                </div>
              )}
            </div>
            <button
              className="profile-button"
              onClick={() => setAccount(true)}
              aria-label="Buka profil akun"
            >
              <span className="user-avatar">
                {props.auth?.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <div className="workspace-toolbar">
          <div>
            <span className="scope-label">
              <ShieldCheck size={14} /> {props.plant?.name}
            </span>
            <span>{props.auth?.role_label}</span>
            <small title={data.metrics.cutoff}>
              Data per{' '}
              {date(data.metrics.cutoff, {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              {zoneLabel}
            </small>
          </div>
          <label className="period-picker">
            <CalendarIcon />
            <input
              type="month"
              aria-label="Periode laporan aktif"
              value={period}
              onInput={(e) => e.currentTarget.value && setPeriod(e.currentTarget.value)}
              onChange={(e) => e.target.value && setPeriod(e.target.value)}
            />
            <ChevronDown size={13} />
          </label>
        </div>
        <main id="main-content" tabIndex={-1} className="main-content" aria-busy={loading}>
          {loading && (
            <div className="loading-notice" role="status">
              Memuat data dari server…
            </div>
          )}
          <ErrorNotice
            error={loadError ?? (props.error ? new Error(props.error) : null)}
            onRetry={() => router.reload()}
          />
          <Suspense
            fallback={
              <div className="empty-state" role="status">
                Memuat halaman…
              </div>
            }
          >
            {content}
          </Suspense>
          <footer className="app-footer">
            <span>
              EPITA <b>·</b> Equipment & Plant Integrated Tracking
            </span>
            <span>
              Cakupan data sesuai kewenangan plant
              <ShieldCheck size={12} />
            </span>
          </footer>
        </main>
      </div>
      {editor && (
        <ReportEditor
          key={editor === true ? 'new' : editor.uuid}
          report={editor === true ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}{' '}
      {detail && !verification && (
        <ReportDetail
          report={detail}
          onClose={() => setDetail(null)}
          onEdit={(r) => {
            setDetail(null);
            setEditor(r);
          }}
          onVerify={(report, fuel) => setVerification({ report, fuel })}
        />
      )}{' '}
      {verification && (
        <FuelVerification
          report={verification.report}
          fuel={verification.fuel}
          onClose={() => setVerification(null)}
          onSaved={() => {
            setVerification(null);
            setDetail(null);
          }}
        />
      )}{' '}
      {breakdown && <RecordForm kind="breakdown" onClose={() => setBreakdown(false)} />}
      {searchOpen && (
        <Modal
          title="Cari di EPITA"
          description="Temukan halaman, equipment, atau laporan operasional."
          onClose={() => setSearchOpen(false)}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Ketik nama halaman, kode, atau alat…"
          />
          <div className="global-search-results">
            <span className="eyebrow">HALAMAN</span>
            {menu
              .flatMap((g) => g.items)
              .filter((i) => !search || i.label.toLowerCase().includes(search.toLowerCase()))
              .map((i) => (
                <Link
                  key={i.key}
                  href={`${base}/${i.key}?plant=${props.plant?.uuid ?? ''}&period=${period}`}
                  onClick={() => setSearchOpen(false)}
                >
                  <i.icon size={17} />
                  <span>{i.label}</span>
                  <ArrowIcon />
                </Link>
              ))}
            {search && (
              <>
                <span className="eyebrow">LAPORAN TERKAIT</span>
                {data.reports
                  .filter((r) =>
                    `${data.equipment.find((e) => e.uuid === r.equipment_uuid)?.name} ${data.equipment.find((e) => e.uuid === r.equipment_uuid)?.code}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .slice(0, 5)
                  .map((r) => (
                    <button key={r.uuid} onClick={() => openReport(r)}>
                      <FileText size={17} />
                      <span>
                        {data.equipment.find((e) => e.uuid === r.equipment_uuid)?.name}
                        <small>
                          {date(r.work_date)} · {labels[r.status]}
                        </small>
                      </span>
                      <ArrowIcon />
                    </button>
                  ))}
              </>
            )}
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="Panduan ruang kerja EPITA"
          description="Alur pencatatan sampai keputusan yang dapat ditelusuri."
          onClose={() => setHelp(false)}
        >
          <div className="help-flow">
            {[
              [
                '1',
                'Susun rencana dan penugasan',
                'Tetapkan pekerjaan, lokasi, target, alat, dan operator. Jadwal yang bertabrakan perlu diselesaikan.',
              ],
              [
                '2',
                'Catat aktivitas di laporan harian',
                'Isi meter, sesi kerja atau perjalanan, volume, helper, lembur, dan bukti. Simpan draft sebelum mengirim.',
              ],
              [
                '3',
                'Periksa dan verifikasi BBM',
                'Pemeriksa lain mengecek kelengkapan. Nilai BBM yang ambigu harus diselesaikan per catatan.',
              ],
              [
                '4',
                'Setujui dan buat laporan',
                'Versi disetujui menjadi sumber angka final. Gunakan Pusat laporan untuk pratinjau dan ekspor.',
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="notice">
            Perawatan menggunakan proses tersendiri: kerusakan → WO → tindakan / spare part →
            pemeriksaan akhir → rilis. Preventive dapat dimulai tanpa breakdown.
          </div>
        </Modal>
      )}
      {account && (
        <Modal
          title="Akun & akses"
          description={props.auth?.email}
          onClose={() => setAccount(false)}
        >
          <div className="account-summary">
            <span className="user-avatar large">{props.auth?.name[0]}</span>
            <div>
              <strong>{props.auth?.name}</strong>
              <small>
                {props.auth?.role_label} · {props.plant?.name}
              </small>
            </div>
          </div>
          <div className="notice">
            Peran dan akses plant ditentukan oleh administrator perusahaan.
          </div>
          <div className="form-actions">
            <Button kind="secondary" onClick={() => router.post('/logout')}>
              <LogOut size={16} />
              Keluar dari akun
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function CalendarIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" />
    </svg>
  );
}
function ArrowIcon() {
  return <ChevronRight size={14} />;
}
