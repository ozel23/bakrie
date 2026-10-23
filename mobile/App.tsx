import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { api, ApiError, loadSession, login, logout, saveSession, type Session } from './src/client';
import {
  cacheValue,
  drafts,
  enqueueDraft,
  openScope,
  operations,
  setCache,
  type FieldDb,
  type LocalDraft,
  type Operation,
} from './src/database';
import { synchronize } from './src/sync';
import { storeEvidence } from './src/evidence';
type Master = { uuid: string; name: string; code?: string; meter_unit?: string; user_id?: number };
type Bootstrap = {
  plant: { uuid: string; name: string };
  offline_until: string;
  cursor: number;
  data: {
    equipment: Master[];
    people: Master[];
    locations: Master[];
    assignments: {
      uuid: string;
      equipment_uuid: string;
      operator_uuid: string;
      starts_at: string;
      ends_at: string;
      status: string;
    }[];
    reports: { uuid: string; status: string; work_date: string }[];
  };
};
const date = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const num = (v: string | number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(Number(v));
const stateLabel: Record<string, string> = {
  local: 'Tersimpan di perangkat',
  draft: 'Draft server',
  queued: 'Menunggu sinkronisasi',
  queued_submit: 'Menunggu pengiriman',
  sending: 'Menyinkronkan',
  applied: 'Berhasil tersinkron',
  submitted: 'Dikirim ke pemeriksa',
  invalid: 'Perlu koreksi data',
  conflict: 'Konflik versi',
  blocked: 'Akses perlu diperiksa',
  auth_required: 'Perlu masuk kembali',
};
function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondary, disabled && { opacity: 0.45 }]}
    >
      <Text style={styles.buttonText}>{children}</Text>
    </TouchableOpacity>
  );
}
function Field({
  label,
  value,
  onChange,
  numeric = false,
  secure = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  secure?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoCapitalize={secure ? 'none' : undefined}
        secureTextEntry={secure}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
      />
    </View>
  );
}
function Choice({
  label,
  value,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  rows: { uuid: string; name: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {rows.map((row) => (
          <TouchableOpacity
            key={row.uuid}
            accessibilityRole="button"
            accessibilityState={{ selected: row.uuid === value }}
            style={[styles.choice, row.uuid === value && styles.choiceActive]}
            onPress={() => onChange(row.uuid)}
          >
            <Text style={styles.choiceText}>{row.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [db, setDb] = useState<FieldDb | null>(null);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [tab, setTab] = useState('Beranda');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [local, setLocal] = useState<LocalDraft[]>([]);
  const [queue, setQueue] = useState<Operation[]>([]);
  const [editor, setEditor] = useState<LocalDraft | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  async function refresh(database: FieldDb) {
    setLocal(await drafts(database));
    setQueue(await operations(database));
    setLastSync(await cacheValue<string>(database, 'last_sync'));
  }
  async function activate(current: Session) {
    let database: FieldDb | null = null;
    try {
      if (current.plant_uuid) {
        database = await openScope(current, current.plant_uuid);
        const cached = await cacheValue<Bootstrap>(database, 'bootstrap');
        if (cached) {
          setBootstrap(cached);
          setSession(current);
          setDb(database);
          await refresh(database);
        }
      }
      try {
        const fresh = await api<Bootstrap>('bootstrap', current);
        const next = {
          ...current,
          plant_uuid: fresh.plant.uuid,
          offline_until: fresh.offline_until,
        };
        if (database && current.plant_uuid !== fresh.plant.uuid) {
          await database.closeAsync();
          database = null;
        }
        if (!database) database = await openScope(next, fresh.plant.uuid);
        await database.runAsync("UPDATE outbox SET status='queued' WHERE status='auth_required'");
        await setCache(database, 'bootstrap', fresh);
        if ((await cacheValue<number>(database, 'cursor')) === null)
          await setCache(database, 'cursor', fresh.cursor);
        await saveSession(next);
        setSession(next);
        setDb(database);
        setBootstrap(fresh);
        await refresh(database);
      } catch (err) {
        if (err instanceof ApiError && [401, 403].includes(err.status)) {
          setSession(null);
          setBootstrap(null);
          if (database) {
            await database.closeAsync();
            setDb(null);
          }
          throw err;
        }
        if (!database) throw err;
        setError('Mode offline. Data tersimpan di perangkat; kirim setelah koneksi tersedia.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Akun belum dapat dibuka.');
    }
  }
  useEffect(() => {
    void loadSession().then((s) => s && activate(s));
  }, []);
  useEffect(() => {
    if (!editor?.equipment_uuid || !editor.operator_uuid || !db) return;
    const timer = setTimeout(() => {
      void enqueueDraft(db, editor)
        .then(() => refresh(db))
        .catch((err) => setError(err.message));
    }, 1200);
    return () => clearTimeout(timer);
  }, [editor, db]);
  async function signIn() {
    setBusy(true);
    setError('');
    try {
      const current = await login(email, password);
      setPassword('');
      await activate(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    if (!db || !session) return;
    setBusy(true);
    setError('');
    try {
      await synchronize(db, session);
      await refresh(db);
      const next = await api<Bootstrap>('bootstrap', session);
      await setCache(db, 'bootstrap', next);
      setBootstrap(next);
      setError('Sinkronisasi selesai. Periksa daftar jika ada catatan yang memerlukan tindakan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koneksi belum tersedia.');
      await refresh(db);
    } finally {
      setBusy(false);
    }
  }
  async function newReport() {
    if (!session || !bootstrap) return;
    const person = bootstrap.data.people.find((p) => p.user_id === session.user.id);
    setEditor({
      uuid: Crypto.randomUUID(),
      version: 0,
      status: 'local',
      equipment_uuid: '',
      operator_uuid: person?.uuid ?? '',
      work_date: date(),
      shift: 'utama',
      condition: 'working',
      meter_start: '',
      meter_end: '',
      notes: '',
      activities: [],
      fuel_events: [],
      helpers: [],
    });
    setConfirm(false);
  }
  async function saveDraft() {
    if (!editor || !db) return;
    if (!editor.equipment_uuid || !editor.operator_uuid) {
      setError('Pilih equipment dan identitas operator.');
      return;
    }
    if (
      editor.meter_start &&
      editor.meter_end &&
      Number(editor.meter_end) < Number(editor.meter_start)
    ) {
      setError('Meter akhir tidak boleh lebih kecil dari meter awal.');
      return;
    }
    try {
      await enqueueDraft(db, editor);
      await refresh(db);
      setEditor(null);
      setTab('Laporan');
      setError('Tersimpan di perangkat. Belum dikirim ke supervisor.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draft belum dapat disimpan.');
    }
  }
  async function submitDraft(draft: LocalDraft) {
    if (!db) return;
    Alert.alert(
      'Konfirmasi pengiriman',
      'Pastikan meter, aktivitas, BBM dan bukti sudah lengkap. Pengiriman baru selesai setelah receipt server diterima.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Masukkan antrean',
          onPress: () =>
            void enqueueDraft(db, draft, true)
              .then(() => refresh(db))
              .then(() => setError('Antre pengiriman; bukti akan diunggah sebelum submit.'))
              .catch((e) => setError(e.message)),
        },
      ],
    );
  }
  async function addPhoto() {
    if (!editor || !db) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      await storeEvidence(
        db,
        editor.uuid,
        a.uri,
        a.fileName ?? `${editor.uuid}.jpg`,
        a.mimeType ?? 'image/jpeg',
      );
      setError('Foto disimpan di perangkat. Unggahan akan mengikuti pengiriman draft.');
    }
  }
  async function signOut() {
    if (!db || !session) return;
    const pending = queue.filter((q) => q.status !== 'applied').length;
    Alert.alert(
      'Keluar dari akun',
      `${pending} operasi belum tersinkron. Data perangkat dipertahankan dan tidak terlihat oleh akun lain. Koneksi diperlukan untuk mencabut token.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          onPress: () =>
            void logout(session)
              .then(async () => {
                await db.closeAsync();
                setDb(null);
                setSession(null);
                setBootstrap(null);
                setLocal([]);
                setQueue([]);
              })
              .catch((e) => setError(e.message)),
        },
      ],
    );
  }
  const change = <K extends keyof LocalDraft>(key: K, value: LocalDraft[K]) =>
    setEditor((e) => (e ? { ...e, [key]: value } : e));
  if (!session || !bootstrap)
    return (
      <SafeAreaView style={styles.login}>
        <StatusBar style="light" />
        <View style={styles.brand}>
          <Text style={styles.logo}>E</Text>
          <View>
            <Text style={styles.brandName}>EPITA FIELD</Text>
            <Text style={styles.brandSmall}>CATAT DI LAPANGAN. TETAP TERHUBUNG.</Text>
          </View>
        </View>
        <View style={styles.loginCard}>
          <Text style={styles.eyebrow}>AKSES OPERATOR</Text>
          <Text style={styles.title}>Mulai hari kerja Anda.</Text>
          <Text style={styles.description}>
            Login pertama membutuhkan koneksi ke server perusahaan. Database server dikonfigurasi
            pada tahap berikutnya.
          </Text>
          <Field label="Email perusahaan" value={email} onChange={setEmail} />
          <Field label="Kata sandi" value={password} onChange={setPassword} secure />
          {error ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {error}
            </Text>
          ) : null}
          <Button onPress={() => void signIn()} disabled={busy}>
            {busy ? 'Memeriksa akun…' : 'Masuk ke EPITA Field'}
          </Button>
          <Text style={styles.caption}>
            Token tersimpan di Keychain / Keystore. Cache SQLite dipisahkan per akun dan plant.
          </Text>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>EPITA FIELD</Text>
          <Text style={styles.headerTitle}>{bootstrap.plant.name}</Text>
        </View>
        <View style={styles.avatar}>
          <Text>{session.user.name.slice(0, 2).toUpperCase()}</Text>
        </View>
      </View>
      {error ? (
        <TouchableOpacity onPress={() => setError('')}>
          <Text accessibilityRole="alert" style={styles.notice}>
            {error}
          </Text>
        </TouchableOpacity>
      ) : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {editor ? (
          <>
            <Text style={styles.title}>Laporan harian</Text>
            <Text style={styles.description}>
              Draft disimpan lokal dan diantre secara atomik. Waktu diisi dengan tanggal lengkap
              serta zona +07:00.
            </Text>
            <Field
              label="Tanggal kerja (YYYY-MM-DD)"
              value={editor.work_date}
              onChange={(v) => change('work_date', v)}
            />
            <Choice
              label="Equipment"
              value={editor.equipment_uuid}
              rows={bootstrap.data.equipment.map((e) => ({
                uuid: e.uuid,
                name: `${e.code} · ${e.name}`,
              }))}
              onChange={(v) => change('equipment_uuid', v)}
            />
            <Choice
              label="Operator"
              value={editor.operator_uuid}
              rows={bootstrap.data.people.filter((p) => p.user_id === session.user.id)}
              onChange={(v) => change('operator_uuid', v)}
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field
                  label="Meter awal"
                  value={editor.meter_start}
                  onChange={(v) => change('meter_start', v)}
                  numeric
                />
              </View>
              <View style={styles.flex}>
                <Field
                  label="Meter akhir"
                  value={editor.meter_end}
                  onChange={(v) => change('meter_end', v)}
                  numeric
                />
              </View>
            </View>
            <Text style={styles.stat}>
              Prestasi:{' '}
              {editor.meter_start && editor.meter_end
                ? num(Number(editor.meter_end) - Number(editor.meter_start))
                : '—'}{' '}
              {bootstrap.data.equipment.find((e) => e.uuid === editor.equipment_uuid)?.meter_unit}
            </Text>
            {editor.activities.map((a, i) => (
              <View style={styles.card} key={i}>
                <Text style={styles.cardTitle}>Aktivitas {i + 1}</Text>
                {(['description', 'starts_at', 'ends_at', 'quantity', 'unit'] as const).map(
                  (key) => (
                    <Field
                      key={key}
                      label={
                        {
                          description: 'Uraian kegiatan',
                          starts_at: 'Mulai (ISO +07:00)',
                          ends_at: 'Selesai (ISO +07:00)',
                          quantity: 'Volume',
                          unit: 'Satuan',
                        }[key]
                      }
                      value={a[key]}
                      numeric={key === 'quantity'}
                      onChange={(v) =>
                        change(
                          'activities',
                          editor.activities.map((x, j) => (i === j ? { ...x, [key]: v } : x)),
                        )
                      }
                    />
                  ),
                )}
                <Field
                  label="Istirahat (menit)"
                  numeric
                  value={String(a.break_seconds / 60)}
                  onChange={(v) =>
                    change(
                      'activities',
                      editor.activities.map((x, j) =>
                        i === j ? { ...x, break_seconds: Number(v) * 60 } : x,
                      ),
                    )
                  }
                />
                <Choice
                  label="Lokasi"
                  value={a.location_uuid ?? ''}
                  rows={bootstrap.data.locations}
                  onChange={(v) =>
                    change(
                      'activities',
                      editor.activities.map((x, j) => (i === j ? { ...x, location_uuid: v } : x)),
                    )
                  }
                />
                <Button
                  secondary
                  onPress={() =>
                    change(
                      'activities',
                      editor.activities.filter((_, j) => j !== i),
                    )
                  }
                >
                  Hapus aktivitas
                </Button>
              </View>
            ))}
            <Button
              secondary
              onPress={() =>
                change('activities', [
                  ...editor.activities,
                  {
                    starts_at: `${editor.work_date}T07:00:00+07:00`,
                    ends_at: `${editor.work_date}T16:00:00+07:00`,
                    break_seconds: 3600,
                    description: '',
                    quantity: '',
                    unit: '',
                  },
                ])
              }
            >
              + Tambah aktivitas / perjalanan
            </Button>
            {editor.fuel_events.map((f, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>BBM {i + 1}</Text>
                <Choice
                  label="Makna"
                  value={f.meaning}
                  rows={[
                    { uuid: 'unverified', name: 'Perlu verifikasi' },
                    { uuid: 'receipt', name: 'Diisi' },
                    { uuid: 'consumption', name: 'Dipakai' },
                  ]}
                  onChange={(v) =>
                    change(
                      'fuel_events',
                      editor.fuel_events.map((x, j) => (i === j ? { ...x, meaning: v } : x)),
                    )
                  }
                />
                <Field
                  label="Liter solar"
                  numeric
                  value={f.quantity}
                  onChange={(v) =>
                    change(
                      'fuel_events',
                      editor.fuel_events.map((x, j) => (i === j ? { ...x, quantity: v } : x)),
                    )
                  }
                />
              </View>
            ))}
            <Button
              secondary
              onPress={() =>
                change('fuel_events', [
                  ...editor.fuel_events,
                  {
                    meaning: 'unverified',
                    quantity: '',
                    unit: 'L',
                    fuel_type: 'Solar',
                    method: 'direct',
                  },
                ])
              }
            >
              + Tambah catatan BBM
            </Button>
            <Choice
              label="Helper (ketuk untuk tambah / hapus, maksimal 4)"
              value=""
              rows={bootstrap.data.people
                .filter((p) => !p.user_id)
                .map((p) => ({
                  uuid: p.uuid,
                  name: p.name + (editor.helpers.some((h) => h.person_uuid === p.uuid) ? ' ✓' : ''),
                }))}
              onChange={(v) =>
                change(
                  'helpers',
                  editor.helpers.some((h) => h.person_uuid === v)
                    ? editor.helpers.filter((h) => h.person_uuid !== v)
                    : editor.helpers.length < 4
                      ? [...editor.helpers, { person_uuid: v, overtime_minutes: 0 }]
                      : editor.helpers,
                )
              }
            />
            {editor.helpers.map((h, i) => (
              <Field
                key={h.person_uuid}
                label={`Lembur ${bootstrap.data.people.find((p) => p.uuid === h.person_uuid)?.name} (menit)`}
                numeric
                value={String(h.overtime_minutes)}
                onChange={(v) =>
                  change(
                    'helpers',
                    editor.helpers.map((x, j) =>
                      i === j ? { ...x, overtime_minutes: Number(v) } : x,
                    ),
                  )
                }
              />
            ))}
            <Field
              label="Catatan lapangan"
              value={editor.notes}
              onChange={(v) => change('notes', v)}
              multiline
            />
            <Button secondary onPress={() => void addPhoto()}>
              Tambahkan foto bukti
            </Button>
            <Button onPress={() => void saveDraft()}>Simpan di perangkat & antrekan</Button>
            <Button secondary onPress={() => setEditor(null)}>
              Kembali
            </Button>
          </>
        ) : (
          <>
            <Text style={styles.eyebrow}>RUANG KERJA OPERATOR</Text>
            <Text style={styles.title}>
              {tab === 'Beranda' ? `Halo, ${session.user.name.split(' ')[0]}.` : tab}
            </Text>
            {tab === 'Beranda' && (
              <>
                <Text style={styles.description}>
                  Selesaikan pencatatan hari ini. Draft tetap tersedia ketika koneksi terputus.
                </Text>
                <View style={styles.row}>
                  <View style={[styles.card, styles.flex]}>
                    <Text style={styles.caption}>Tugas tersimpan</Text>
                    <Text style={styles.large}>{bootstrap.data.assignments.length}</Text>
                  </View>
                  <View style={[styles.card, styles.flex]}>
                    <Text style={styles.caption}>Perlu sinkronisasi</Text>
                    <Text style={styles.large}>
                      {queue.filter((o) => o.status !== 'applied').length}
                    </Text>
                  </View>
                </View>
                <Button onPress={() => void newReport()}>+ Laporan baru</Button>
                <Button secondary onPress={() => setTab('Tugas')}>
                  Lihat tugas saya
                </Button>
              </>
            )}
            {tab === 'Tugas' && (
              <>
                {bootstrap.data.assignments.map((a) => (
                  <View style={styles.card} key={a.uuid}>
                    <Text style={styles.cardTitle}>
                      {bootstrap.data.equipment.find((e) => e.uuid === a.equipment_uuid)?.name}
                    </Text>
                    <Text style={styles.description}>
                      {new Date(a.starts_at).toLocaleString('id-ID')} –{' '}
                      {new Date(a.ends_at).toLocaleString('id-ID')}
                    </Text>
                    <Text style={styles.tag}>{a.status}</Text>
                  </View>
                ))}
                {!bootstrap.data.assignments.length && (
                  <Text style={styles.description}>
                    Belum ada tugas dalam cache. Sinkronkan setelah supervisor menugaskan pekerjaan.
                  </Text>
                )}
              </>
            )}
            {tab === 'Laporan' && (
              <>
                <Button onPress={() => void newReport()}>+ Buat laporan harian</Button>
                {local.map((d) => (
                  <View key={d.uuid} style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {bootstrap.data.equipment.find((e) => e.uuid === d.equipment_uuid)?.name}
                    </Text>
                    <Text style={styles.caption}>
                      {d.work_date} · {d.shift}
                    </Text>
                    <Text style={styles.tag}>{stateLabel[d.status] ?? d.status}</Text>
                    {!['approved', 'submitted', 'reviewed', 'queued_submit'].includes(d.status) && (
                      <>
                        <Button secondary onPress={() => setEditor(d)}>
                          Buka / perbaiki draft
                        </Button>
                        <Button onPress={() => void submitDraft(d)}>
                          Konfirmasi & antre pengiriman
                        </Button>
                      </>
                    )}
                  </View>
                ))}
                {!local.length && (
                  <Text style={styles.description}>Belum ada draft pada akun dan plant ini.</Text>
                )}
              </>
            )}
            {tab === 'Sinkronisasi' && (
              <>
                <Text style={styles.description}>
                  Terakhir berhasil:{' '}
                  {lastSync ? new Date(lastSync).toLocaleString('id-ID') : 'Belum pernah'}
                </Text>
                <Button onPress={() => void sync()} disabled={busy}>
                  {busy ? 'Menyinkronkan…' : 'Sinkronkan sekarang'}
                </Button>
                {queue.map((o) => (
                  <View key={o.operation_id} style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {o.action === 'submit' ? 'Pengiriman laporan' : 'Penyimpanan draft'}
                    </Text>
                    <Text style={styles.tag}>{stateLabel[o.status] ?? o.status}</Text>
                    <Text style={styles.caption}>Percobaan: {o.attempt_count}</Text>
                    {o.last_error && <Text style={styles.error}>{o.last_error}</Text>}
                    {o.status === 'conflict' && (
                      <Text style={styles.description}>
                        Draft lokal dipertahankan. Bandingkan dengan versi server melalui pemeriksa;
                        versi final tidak ditimpa otomatis.
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}
            {tab === 'Akun' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{session.user.name}</Text>
                  <Text style={styles.description}>{session.user.email}</Text>
                  <Text style={styles.caption}>
                    Akses offline sampai {new Date(session.offline_until).toLocaleString('id-ID')}
                  </Text>
                </View>
                <Text style={styles.description}>
                  Draft dan foto dipertahankan di penyimpanan akun ini. Perpindahan akun membuka
                  database yang berbeda.
                </Text>
                <Button secondary onPress={() => void signOut()}>
                  Keluar & cabut token perangkat
                </Button>
              </>
            )}
          </>
        )}
      </ScrollView>
      {!editor && (
        <View style={styles.tabs}>
          {['Beranda', 'Tugas', 'Laporan', 'Sinkronisasi', 'Akun'].map((t) => (
            <TouchableOpacity
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.activeTab]}
            >
              <Text style={[styles.tabText, tab === t && { color: '#0a3553', fontWeight: '700' }]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  login: { flex: 1, backgroundColor: '#0a3553' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 28, paddingTop: 35 },
  logo: { color: '#ffd301', fontWeight: '900', fontSize: 40 },
  brandName: { color: '#fff', fontWeight: '700', fontSize: 22, letterSpacing: 2 },
  brandSmall: { color: '#91b8ce', fontSize: 8, letterSpacing: 1, marginTop: 6 },
  loginCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    flex: 1,
    padding: 27,
    paddingTop: 35,
  },
  app: { flex: 1, backgroundColor: '#f5f7fb' },
  header: {
    paddingHorizontal: 22,
    paddingVertical: 17,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e5edf3',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 17, color: '#183246', fontWeight: '600', marginTop: 5 },
  avatar: {
    width: 37,
    height: 37,
    borderRadius: 20,
    backgroundColor: '#eaf2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 22, paddingBottom: 35 },
  eyebrow: {
    fontSize: 9,
    color: '#7393a9',
    fontWeight: '600',
    letterSpacing: 1.4,
    marginBottom: 9,
  },
  title: {
    fontSize: 26,
    color: '#183246',
    fontWeight: '700',
    letterSpacing: -0.7,
    marginBottom: 10,
  },
  description: { fontSize: 13, color: '#8298a8', lineHeight: 22, marginBottom: 17 },
  field: { marginBottom: 17 },
  label: { fontSize: 12, color: '#55758d', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#dfe8ef',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#183246',
    backgroundColor: '#fff',
    minHeight: 46,
  },
  button: {
    backgroundColor: '#ffd301',
    borderWidth: 1,
    borderColor: '#e5c321',
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 12,
  },
  secondary: { backgroundColor: '#fff', borderColor: '#dfe8ef' },
  buttonText: { fontSize: 12, fontWeight: '600', color: '#183246' },
  caption: { fontSize: 11, color: '#96aabb', lineHeight: 20 },
  notice: {
    padding: 14,
    backgroundColor: '#fff9dd',
    fontSize: 12,
    color: '#8c7d41',
    lineHeight: 20,
  },
  row: { flexDirection: 'row', gap: 13 },
  flex: { flex: 1 },
  card: {
    padding: 18,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e4ecf2',
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#274d66', marginBottom: 10 },
  large: { fontSize: 31, color: '#183246', fontWeight: '700', marginTop: 8 },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: '#eaf3f8',
    color: '#6791ab',
    fontSize: 10,
    borderRadius: 5,
    padding: 7,
    marginVertical: 10,
  },
  choice: {
    padding: 11,
    borderWidth: 1,
    borderColor: '#e1ebf2',
    backgroundColor: '#fff',
    borderRadius: 7,
    marginRight: 8,
    minHeight: 43,
    justifyContent: 'center',
  },
  choiceActive: { backgroundColor: '#e5f2f9', borderColor: '#89c7e7' },
  choiceText: { fontSize: 11, color: '#527b95' },
  stat: {
    backgroundColor: '#eaf3f8',
    color: '#456e87',
    padding: 14,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 19,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderColor: '#e5edf3',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tab: { flex: 1, minHeight: 43, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  activeTab: { backgroundColor: '#fffbe1' },
  tabText: { fontSize: 9, color: '#8fa5b5' },
  error: { fontSize: 11, color: '#b66956', lineHeight: 19, marginVertical: 10 },
});
