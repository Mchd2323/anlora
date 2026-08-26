/**
 * Anlık bildirim (Android).
 *
 * TASARIM KARARLARI
 *
 * 1. İZİN İSTENMEDEN ÖNCE SEBEP SÖYLENİR. Uygulama açılır açılmaz sistem
 *    izin penceresini göstermek, kullanıcının çoğu zaman düşünmeden
 *    reddetmesine yol açar — ve Android'de bir kez reddedilen izin bir daha
 *    sorulamaz. Bu yüzden izin ancak kullanıcı ayarlardan bildirimleri
 *    AÇTIĞINDA isteniyor.
 *
 * 2. TERCİH CİHAZDA VE SUNUCUDA. Kullanıcı hangi türleri istediğini seçiyor;
 *    sunucu "herkese gönder" dese bile o türü kapatmış cihaza gönderilmiyor.
 *
 * 3. YALNIZCA YEREL KABUKTA. Tarayıcıda bu eklenti yok; bütün işlevler
 *    sessizce "yapılamaz" döner ve arayüz bunu dürüstçe gösterir.
 */

import { apiUrl } from '../config/api';
import { getSessionToken } from '../utils/authClient';
import { readJSON, writeJSON } from '../utils/safeStorage';

export interface PushPreferences {
  enabled: boolean;
  announcements: boolean;
  reminders: boolean;
  /** Son kaydedilen cihaz jetonu; kapatırken sunucudan silmek için. */
  token?: string;
}

const PREFS_KEY = 'anlora.pushPrefs.v1';

const DEFAULTS: PushPreferences = {
  enabled: false,
  announcements: true,
  reminders: true
};

export function getPushPreferences(): PushPreferences {
  return { ...DEFAULTS, ...readJSON<PushPreferences>(PREFS_KEY, DEFAULTS) };
}

function savePreferences(prefs: PushPreferences): void {
  writeJSON(PREFS_KEY, prefs);
}

/** Bu cihazda anlık bildirim mümkün mü? */
export async function isPushAvailable(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;
    return Capacitor.isPluginAvailable('PushNotifications');
  } catch {
    return false;
  }
}

async function loadPlugin() {
  try {
    const mod = await import('@capacitor/push-notifications');
    return mod.PushNotifications;
  } catch {
    return null;
  }
}

async function registerToken(token: string, prefs: PushPreferences): Promise<void> {
  const session = getSessionToken();
  try {
    await fetch(apiUrl('/api/devices/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session}` } : {})
      },
      body: JSON.stringify({
        token,
        platform: 'android',
        topics: { announcements: prefs.announcements, reminders: prefs.reminders }
      })
    });
  } catch {
    /* sunucuya ulaşılamıyorsa bildirim de gelmeyecek; sessizce geçilir */
  }
}

/**
 * Bildirimleri açar: izin ister, jetonu alır ve sunucuya kaydeder.
 *
 * @returns Başarılıysa true. İzin reddedilirse false — ve bu kalıcıdır,
 *          kullanıcı ancak sistem ayarlarından geri açabilir.
 */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!(await isPushAvailable())) {
    return { ok: false, reason: 'Bu sürümde anlık bildirim yok; uygulamayı telefonuna kurduğunda çalışır.' };
  }

  const plugin = await loadPlugin();
  if (!plugin) return { ok: false, reason: 'Bildirim eklentisi yüklenemedi.' };

  try {
    let permission = await plugin.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await plugin.requestPermissions();
    }

    if (permission.receive !== 'granted') {
      return {
        ok: false,
        reason:
          'Bildirim izni verilmedi. Telefon ayarlarından Anlora için bildirimleri açabilirsin.'
      };
    }

    /*
     * Jeton kaydı ASENKRON gelir: `register()` çağrısı bir olay tetikler,
     * jeton o olayla ulaşır. Söz burada olayı bekleyecek şekilde sarılıyor,
     * yoksa jetonu almadan "açıldı" demiş olurduk.
     */
    const token = await new Promise<string | null>(resolve => {
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      void plugin.addListener('registration', ({ value }) => finish(value));
      void plugin.addListener('registrationError', () => finish(null));
      void plugin.register();

      // Firebase yanıt vermezse sonsuza kadar beklenmesin.
      setTimeout(() => finish(null), 10_000);
    });

    if (!token) {
      return { ok: false, reason: 'Cihaz kaydı alınamadı. Bağlantını kontrol edip tekrar dene.' };
    }

    const prefs = { ...getPushPreferences(), enabled: true, token };
    savePreferences(prefs);
    await registerToken(token, prefs);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Bildirimler açılamadı.' };
  }
}

/** Bildirimleri kapatır ve cihaz kaydını sunucudan siler. */
export async function disablePush(): Promise<void> {
  const prefs = getPushPreferences();

  if (prefs.token) {
    try {
      await fetch(apiUrl(`/api/devices/${encodeURIComponent(prefs.token)}`), {
        method: 'DELETE'
      });
    } catch {
      /* sunucuya ulaşılamasa da yerel tercih kapanmalı */
    }
  }

  savePreferences({ ...prefs, enabled: false, token: undefined });

  const plugin = await loadPlugin();
  await plugin?.removeAllListeners().catch(() => undefined);
}

/** Tür tercihini günceller ve sunucuya bildirir. */
export async function updatePushTopics(
  topics: Partial<Pick<PushPreferences, 'announcements' | 'reminders'>>
): Promise<void> {
  const prefs = { ...getPushPreferences(), ...topics };
  savePreferences(prefs);
  if (prefs.enabled && prefs.token) await registerToken(prefs.token, prefs);
}
