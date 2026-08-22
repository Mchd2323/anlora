/**
 * Kimlik doğrulama istemcisi.
 *
 * Sunucu artık oturum jetonu (`Authorization: Bearer ...`) bekliyor. Önceki
 * sürümde istemci yalnızca e-posta adresini gönderiyordu; sunucu da bunu tek
 * kimlik olarak kabul ettiği için başkasının e-postasını yazan herkes onun
 * verisini okuyup üzerine yazabiliyordu. Jeton bu kapıyı kapatır.
 */

import { readRaw, writeRaw, removeKey } from './safeStorage';

const TOKEN_KEY = 'anlora_session_token';
const TOKEN_EXPIRY_KEY = 'anlora_session_expires_at';

export function getSessionToken(): string | null {
  const token = readRaw(TOKEN_KEY);
  if (!token) return null;

  const expiresAt = Number(readRaw(TOKEN_EXPIRY_KEY) || 0);
  if (expiresAt && expiresAt < Date.now()) {
    clearSession();
    return null;
  }
  return token;
}

export function storeSession(token: string, expiresAt?: number): void {
  writeRaw(TOKEN_KEY, token);
  if (expiresAt) writeRaw(TOKEN_EXPIRY_KEY, String(expiresAt));
}

export function clearSession(): void {
  removeKey(TOKEN_KEY);
  removeKey(TOKEN_EXPIRY_KEY);
}

export function isSignedIn(): boolean {
  return getSessionToken() !== null;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
}

function toApiError(message: string, status: number, code?: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  return error;
}

/**
 * Oturum jetonunu ekleyerek istek gönderir ve JSON yanıtı çözer.
 * 401 alındığında yerel oturum temizlenir; böylece arayüz süresi dolmuş bir
 * jetonla sonsuza kadar "giriş yapılmış" görünmez.
 */
export async function apiFetch<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getSessionToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...init, headers });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    /* gövdesiz yanıt olabilir */
  }

  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw toApiError(
      data?.error || 'İstek tamamlanamadı. Lütfen tekrar deneyin.',
      response.status,
      data?.code
    );
  }

  return data as T;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Sunucuya ulaşılamasa bile yerel oturum kapatılmalı.
  } finally {
    clearSession();
  }
}
