/**
 * Kimlik doğrulama istemcisi.
 *
 * Sunucu artık oturum jetonu (`Authorization: Bearer ...`) bekliyor. Önceki
 * sürümde istemci yalnızca e-posta adresini gönderiyordu; sunucu da bunu tek
 * kimlik olarak kabul ettiği için başkasının e-postasını yazan herkes onun
 * verisini okuyup üzerine yazabiliyordu. Jeton bu kapıyı kapatır.
 */

import { readRaw, writeRaw, removeKey } from './safeStorage';
import { apiUrl } from '../config/api';

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

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    // Ağ hiç kurulamadı: çevrimdışıyız ya da adres yanlış.
    throw toApiError(
      'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.',
      0,
      'NETWORK'
    );
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    /* gövdesiz ya da JSON olmayan yanıt */
  }

  /*
   * JSON BEKLENEN YERDE JSON YOKSA BU BİR HATADIR.
   *
   * Önceki sürüm başarısız çözümlemeyi sessizce geçip `null` döndürüyordu.
   * APK'da sunucu adresi tanımlı olmadığında `/api/auth/register` isteği
   * uygulamanın KENDİ paketine gidiyor, Capacitor da 200 ile `index.html`
   * döndürüyordu: `response.ok` doğru, gövde HTML, `data` null. Çağıran taraf
   * `data.devCode` okuyunca kullanıcı "Cannot read properties of null
   * (reading 'devCode')" hatasını görüyordu — gerçek sebep olan "sunucu yok"
   * bilgisi hiçbir yerde görünmüyordu.
   */
  if (response.ok && data === null) {
    throw toApiError(
      'Sunucuya ulaşılamadı. Bu sürüm çevrimdışı çalışıyor; hesap ve bulut ' +
        'yedeği için sunucu adresi tanımlı değil.',
      response.status,
      'NO_SERVER'
    );
  }

  if (!response.ok) {
    if (response.status === 401) clearSession();

    /*
     * Yanıt JSON değilse bu bir uygulama hatası değil, sunucusuzluktur.
     *
     * Sunucu adresi tanımlı olmayan bir kurulumda `/api/...` isteği web
     * sunucusunun 404 sayfasına ya da uygulamanın kendi index.html'ine
     * gider. Kullanıcıya "İstek tamamlanamadı, tekrar dene" demek onu
     * sonsuza kadar denemeye iter; asıl sebebi söylemek gerekir.
     */
    if (data === null) {
      throw toApiError(
        'Sunucuya ulaşılamadı. Bu sürüm çevrimdışı çalışıyor; hesap, bulut ' +
          'yedeği ve paylaşım için sunucu adresi tanımlı değil.',
        response.status,
        'NO_SERVER'
      );
    }

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
