const fields = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    fields(new Date(0), value);
    return true;
  } catch {
    return false;
  }
}

export function toLocalInput(value: string, timeZone: string): string {
  if (!value) return '';
  const part = fields(new Date(value), timeZone);
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}:${part.second}`;
}

export function fromLocalInput(value: string, timeZone: string): string {
  if (!validTimeZone(timeZone))
    throw new RangeError('Zona waktu plant belum valid. Hubungi administrator.');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new RangeError('Tanggal dan waktu belum lengkap.');
  const [, year, month, day, hour, minute, second = '00'] = match;
  const wall = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const expected = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const offsets = new Set<number>();
  for (const distance of [-86400000, 0, 86400000]) {
    const instant = wall + distance;
    const part = fields(new Date(instant), timeZone);
    offsets.add(
      Date.UTC(
        Number(part.year),
        Number(part.month) - 1,
        Number(part.day),
        Number(part.hour),
        Number(part.minute),
        Number(part.second),
      ) - instant,
    );
  }
  const candidates = [...offsets]
    .map((offset) => wall - offset)
    .filter((instant) => toLocalInput(new Date(instant).toISOString(), timeZone) === expected);
  if (candidates.length !== 1)
    throw new RangeError(
      candidates.length
        ? 'Waktu ini terjadi dua kali pada zona waktu plant. Pilih waktu yang tidak ambigu.'
        : 'Waktu ini tidak tersedia pada zona waktu plant. Periksa kembali tanggal dan jam.',
    );
  return new Date(candidates[0]).toISOString();
}

export function todayInZone(timeZone: string, now = new Date()): string {
  const part = fields(now, timeZone);
  return `${part.year}-${part.month}-${part.day}`;
}

export function formatDate(
  value: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value || !Number.isFinite(Date.parse(value)) || !validTimeZone(timeZone)) return '—';
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (calendarDate && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value)
    return '—';
  return new Intl.DateTimeFormat('id-ID', {
    ...(options ?? { day: 'numeric', month: 'short', year: 'numeric' }),
    timeZone: calendarDate ? 'UTC' : timeZone,
  }).format(new Date(calendarDate ? `${value}T12:00:00Z` : value));
}

export function timeZoneLabel(timeZone: string): string {
  return (
    (
      {
        'Asia/Jakarta': 'WIB',
        'Asia/Pontianak': 'WIB',
        'Asia/Makassar': 'WITA',
        'Asia/Jayapura': 'WIT',
      } as Record<string, string>
    )[timeZone] ?? timeZone
  );
}
