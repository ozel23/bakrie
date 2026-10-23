import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { canAccessOffline } from './retry.mjs';
export type Session = {
  token: string;
  user: { id: number; name: string; email: string };
  device_id: string;
  offline_until: string;
  plant_uuid?: string;
};
const sessionKey = 'epita.session';
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.message ?? 'Koneksi gagal.'));
  }
}
export async function api<T>(
  path: string,
  session?: Session | null,
  body?: unknown,
  method = body ? 'POST' : 'GET',
): Promise<T> {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) throw new Error('Isi EXPO_PUBLIC_API_URL sebelum menghubungkan EPITA Field.');
  const response = await fetch(`${url.replace(/\/$/, '')}/${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const result = await response
    .json()
    .catch(() => ({ message: 'Respons server tidak dapat dibaca.' }));
  if (!response.ok) throw new ApiError(response.status, result);
  return result;
}
export async function loadSession(): Promise<Session | null> {
  const saved = await SecureStore.getItemAsync(sessionKey);
  if (!saved) return null;
  const session = JSON.parse(saved) as Session;
  return canAccessOffline(session.offline_until) ? session : null;
}
export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(sessionKey, JSON.stringify(session));
}
export async function login(email: string, password: string): Promise<Session> {
  let device = await SecureStore.getItemAsync('epita.device');
  if (!device) {
    device = Crypto.randomUUID();
    await SecureStore.setItemAsync('epita.device', device);
  }
  const result = await api<Omit<Session, 'device_id'>>('auth/login', null, {
    email,
    password,
    device_id: device,
  });
  const session = { ...result, device_id: device };
  await saveSession(session);
  return session;
}
export async function logout(session: Session): Promise<void> {
  await api('auth/logout', session, {});
  await SecureStore.deleteItemAsync(sessionKey);
}
