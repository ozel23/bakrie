export class ActionError extends Error {
  constructor(
    message: string,
    public errors: Record<string, string> = {},
    public status = 0,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function csrfHeaders(): Record<string, string> {
  const cookie = document.cookie.split('; ').find((value) => value.startsWith('XSRF-TOKEN='));
  if (cookie) {
    try {
      return { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) };
    } catch {}
  }
  return {
    'X-CSRF-TOKEN':
      document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
  };
}

export function responseError(status: number, body: unknown, requestId?: string): ActionError {
  const data = isRecord(body) ? body : {};
  const defaults: Record<number, string> = {
    401: 'Sesi Anda berakhir. Silakan masuk kembali.',
    403: 'Anda tidak memiliki izin untuk tindakan ini.',
    404: 'Data atau layanan yang diminta belum tersedia.',
    409: 'Data telah berubah. Periksa versi terbaru sebelum mencoba kembali.',
    419: 'Sesi Anda berakhir. Silakan masuk kembali sebelum menyimpan.',
    422: 'Periksa kembali isian yang ditandai.',
    429: 'Terlalu banyak permintaan. Tunggu sebentar sebelum mencoba kembali.',
  };
  const message =
    status >= 500
      ? 'Layanan belum dapat memproses permintaan. Perubahan belum dapat dikonfirmasi. Silakan coba lagi.'
      : status === 401 || status === 419
        ? defaults[status]
        : typeof data.message === 'string'
          ? data.message
          : (defaults[status] ?? 'Permintaan belum berhasil.');
  const errors =
    status === 422 && isRecord(data.errors)
      ? Object.fromEntries(
          Object.entries(data.errors).flatMap(([key, value]) => {
            const first = Array.isArray(value) ? value[0] : value;
            return typeof first === 'string' ? [[key, first]] : [];
          }),
        )
      : {};
  const reference = typeof data.request_id === 'string' ? data.request_id : requestId;
  return new ActionError(message, errors, status, reference);
}

async function send(
  url: string,
  payload: unknown,
  method: string,
  accept: string,
): Promise<Response> {
  const multipart = payload instanceof FormData;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: accept,
        ...csrfHeaders(),
        ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload === undefined ? undefined : multipart ? payload : JSON.stringify(payload),
      credentials: 'same-origin',
    });
  } catch {
    throw new ActionError(
      'Koneksi terputus. Hasil permintaan belum dapat dikonfirmasi. Input Anda tetap tersedia.',
    );
  }
  if (response.redirected && new URL(response.url, window.location.origin).pathname === '/login') {
    throw responseError(401, null, response.headers.get('X-Request-ID') ?? undefined);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw responseError(response.status, body, response.headers.get('X-Request-ID') ?? undefined);
  }
  return response;
}

export async function request<T = unknown>(
  url: string,
  payload?: unknown,
  method = 'POST',
): Promise<T> {
  const response = await send(url, payload, method, 'application/json');
  const reference = response.headers.get('X-Request-ID') ?? undefined;
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) {
    throw new ActionError(
      'Respons layanan belum dapat dikonfirmasi. Periksa data terbaru sebelum mengulang permintaan.',
      {},
      response.status,
      reference,
    );
  }
  return body as T;
}

export async function requestFile(
  url: string,
  payload: unknown,
  output: 'pdf' | 'xlsx',
): Promise<Blob> {
  const contentType =
    output === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const response = await send(url, payload, 'POST', contentType);
  const reference = response.headers.get('X-Request-ID') ?? undefined;
  if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== contentType) {
    throw new ActionError(
      'Berkas laporan belum dapat dikonfirmasi. Silakan coba lagi.',
      {},
      response.status,
      reference,
    );
  }
  const blob = await response.blob();
  const signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const valid =
    output === 'pdf'
      ? String.fromCharCode(...signature) === '%PDF-'
      : signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 3 && signature[3] === 4;
  if (!valid)
    throw new ActionError(
      'Berkas laporan belum dapat dibaca. Silakan coba lagi.',
      {},
      response.status,
      reference,
    );
  return blob;
}
