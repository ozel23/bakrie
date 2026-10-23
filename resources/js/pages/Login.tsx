import { Head, useForm } from '@inertiajs/react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Truck,
  Wrench,
  BarChart3,
} from 'lucide-react';
import { useState } from 'react';
import { ActionError, responseError } from '../lib/http';
import { ErrorNotice } from '../components/UI';
export default function Login({ status }: { status?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [help, setHelp] = useState(false);
  const [connectionError, setConnectionError] = useState<unknown>(null);
  const form = useForm({ email: '', password: '', remember: false });
  return (
    <>
      <Head title="Masuk" />
      <div className="login-page">
        <section className="login-story">
          <div className="brand brand-light">
            <span className="brand-mark">
              E<span />
            </span>
            <span>
              EPITA<small>OPERATIONS PLATFORM</small>
            </span>
          </div>
          <div className="login-copy">
            <span className="eyebrow light">
              <span className="live-dot" /> SATU PLATFORM. SELURUH OPERASIONAL.
            </span>
            <h1>
              Setiap alat.
              <br />
              Setiap aktivitas.
              <br />
              <em>Terhubung.</em>
            </h1>
            <p>
              Kelola alat berat, kendaraan, dan mesin dengan data lapangan yang tertata dan
              keputusan yang dapat ditelusuri.
            </p>
            <div className="login-pillars">
              <div>
                <Truck size={19} />
                <span>Operasional alat</span>
              </div>
              <div>
                <Wrench size={19} />
                <span>Perawatan terencana</span>
              </div>
              <div>
                <BarChart3 size={19} />
                <span>Pelaporan terpadu</span>
              </div>
            </div>
          </div>
          <div className="login-footer">
            <span>Equipment & Plant Integrated Tracking</span>
            <span>EPITA / 2026</span>
          </div>
          <div className="login-grid-art" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </section>
        <main className="login-form-wrap">
          <div className="login-form">
            <span className="login-icon">
              <LockKeyhole size={24} />
            </span>
            <span className="eyebrow">SELAMAT DATANG DI EPITA</span>
            <h2>Masuk ke ruang kerja</h2>
            <p>Gunakan akun yang terdaftar di perusahaan Anda.</p>
            <form
              aria-busy={form.processing}
              onSubmit={(e) => {
                e.preventDefault();
                if (form.processing) return;
                setConnectionError(null);
                form.post('/login', {
                  onError: () => form.reset('password'),
                  onHttpException: (response) => {
                    form.reset('password');
                    const reference = response.headers['x-request-id'];
                    setConnectionError(
                      responseError(
                        response.status,
                        response.data,
                        typeof reference === 'string' ? reference : undefined,
                      ),
                    );
                    return false;
                  },
                  onNetworkError: () => {
                    setConnectionError(
                      new ActionError('Koneksi terputus. Login belum berhasil. Silakan coba lagi.'),
                    );
                    return false;
                  },
                });
              }}
            >
              <label htmlFor="email">Email akun</label>
              <input
                autoComplete="username"
                id="email"
                type="email"
                placeholder="nama@perusahaan.co.id"
                value={form.data.email}
                onChange={(e) => form.setData('email', e.target.value)}
                required
                autoFocus
                aria-invalid={!!form.errors.email}
                aria-describedby={form.errors.email ? 'email-error' : undefined}
              />
              {form.errors.email && (
                <span id="email-error" className="field-error" role="alert">
                  {form.errors.email}
                </span>
              )}
              <div className="label-row">
                <label htmlFor="password">Kata sandi</label>
                <button
                  className="text-button"
                  type="button"
                  aria-expanded={help}
                  aria-controls="login-help"
                  onClick={() => setHelp(!help)}
                >
                  Bantuan akses
                </button>
              </div>
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan kata sandi"
                  value={form.data.password}
                  onChange={(e) => form.setData('password', e.target.value)}
                  required
                  aria-invalid={!!form.errors.password}
                  aria-describedby={form.errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {form.errors.password && (
                <span id="password-error" className="field-error" role="alert">
                  {form.errors.password}
                </span>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={form.data.remember}
                  onChange={(e) => form.setData('remember', e.target.checked)}
                />{' '}
                Ingat saya di perangkat ini
              </label>
              {help && (
                <div className="notice" id="login-help">
                  Hubungi administrator perusahaan untuk pembuatan akun, pengaturan plant, atau
                  penggantian kata sandi. Tidak ada pendaftaran publik.
                </div>
              )}
              {status && (
                <div className="error-notice" role="alert">
                  {status}
                </div>
              )}
              <ErrorNotice error={connectionError} />
              <button className="button primary login-submit" disabled={form.processing}>
                {form.processing ? 'Memverifikasi akun…' : 'Masuk ke dashboard'}
                <ArrowRight size={18} />
              </button>
            </form>
            <div className="secure-caption">
              <ShieldCheck size={15} /> Akses mengikuti peran dan kewenangan plant Anda
            </div>
          </div>
          <div className="login-bottom">
            © 2026 EPITA <span>Operasional yang lebih terarah.</span>
          </div>
        </main>
      </div>
    </>
  );
}
