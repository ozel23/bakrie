import { Head, Link, router } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, RefreshCw, LogOut } from 'lucide-react';

export default function ErrorPage({
  status,
  message,
  requestId,
}: {
  status: number;
  message: string;
  requestId?: string;
}) {
  const titles: Record<number, string> = {
    401: 'Silakan masuk kembali',
    403: 'Akses belum tersedia',
    404: 'Halaman tidak ditemukan',
    409: 'Data telah berubah',
    419: 'Sesi Anda berakhir',
    429: 'Permintaan terlalu sering',
    500: 'Layanan belum dapat memproses permintaan',
    502: 'Layanan belum dapat dijangkau',
    503: 'Layanan penyimpanan belum tersedia',
  };
  return (
    <main className="service-error-page">
      <Head title={titles[status] ?? 'Permintaan belum berhasil'} />
      <div className="service-error-card">
        <span className="brand">
          <span className="brand-mark">
            E<span />
          </span>{' '}
          EPITA
        </span>
        <AlertCircle size={36} aria-hidden="true" />
        <span className="eyebrow">{status}</span>
        <h1>{titles[status] ?? 'Permintaan belum berhasil'}</h1>
        <p role="alert">{message}</p>
        {requestId && (
          <small>
            Referensi bantuan: <code>{requestId}</code>
          </small>
        )}
        <div className="form-actions">
          <Link className="button secondary" href="/login">
            <ArrowLeft size={16} /> Ke halaman masuk
          </Link>
          {status >= 500 && (
            <button className="button primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Coba kembali
            </button>
          )}
          {status === 403 && (
            <button className="button secondary" onClick={() => router.post('/logout')}>
              <LogOut size={16} /> Keluar
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
