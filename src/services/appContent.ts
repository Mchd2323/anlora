/**
 * Sunucudan gelen uygulama içeriği: reklam alanları, duyurular, marka metinleri.
 *
 * ÇEVRİMDIŞI ÖNCELİKLİ. Uygulamanın öğretme işlevi tamamen cihazda çalışır;
 * bu modülün getirdiği her şey İSTEĞE BAĞLI süstür. Sunucu yoksa, ağ yoksa
 * ya da istek başarısız olursa uygulama pakete gömülü varsayılanlarla
 * çalışmaya devam eder — hiçbir yerde bekleme ya da hata ekranı çıkmaz.
 *
 * Bu yüzden burada `throw` yok: başarısızlık sessizce "içerik yok" demektir.
 */

import { apiUrl } from '../config/api';
import { getSessionToken } from '../utils/authClient';
import { readJSON, writeJSON } from '../utils/safeStorage';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface AppBranding {
  logoDataUri?: string;
  appName?: string;
  slogan?: string;
  homeIntro?: string;
  setsIntro?: string;
  lookupTitle?: string;
  lookupBody?: string;
}

export interface AppContent {
  /** Alan kimliği → gömme kodu. Yalnızca DOLU alanlar bulunur. */
  ads: Record<string, string>;
  announcements: Announcement[];
  branding: AppBranding;
}

const EMPTY: AppContent = { ads: {}, announcements: [], branding: {} };

/**
 * Son başarılı yanıt yerelde saklanır.
 *
 * Kullanıcı uygulamayı çevrimdışı açtığında bir önceki duyuruyu ve marka
 * metinlerini yine görür. Sunucuya her açılışta ulaşılabileceğini varsaymak,
 * metroda açan kullanıcıya boş bir başlık göstermek olurdu.
 */
const CACHE_KEY = 'anlora.appContent.v1';

let current: AppContent = readJSON<AppContent>(CACHE_KEY, EMPTY);
const listeners = new Set<(content: AppContent) => void>();

export function getAppContent(): AppContent {
  return current;
}

export function subscribeAppContent(listener: (content: AppContent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(content: AppContent): void {
  current = content;
  writeJSON(CACHE_KEY, content);
  listeners.forEach(listener => {
    try {
      listener(content);
    } catch {
      /* bir dinleyicinin hatası diğerlerini engellemesin */
    }
  });
}

/** İçeriği tazeler. Başarısız olursa elde ne varsa onunla devam edilir. */
export async function refreshAppContent(): Promise<void> {
  try {
    const token = getSessionToken();
    const response = await fetch(apiUrl('/api/app-content'), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) return;

    const contentType = response.headers.get('content-type') || '';
    // Sunucu yoksa Capacitor kendi index.html'ini 200 ile döndürür; JSON
    // bekleyip HTML almak "içerik yok" demektir, hata değil.
    if (!contentType.includes('application/json')) return;

    const data = await response.json();
    publish({
      ads: data?.ads && typeof data.ads === 'object' ? data.ads : {},
      announcements: Array.isArray(data?.announcements) ? data.announcements : [],
      branding: data?.branding && typeof data.branding === 'object' ? data.branding : {}
    });
  } catch {
    /* çevrimdışıyız ya da sunucu yok; önbellekteki içerik geçerli kalır */
  }
}

/** Kullanıcının okuduğu duyuru kimlikleri. */
const SEEN_KEY = 'anlora.seenAnnouncements.v1';

export function getUnseenAnnouncements(): Announcement[] {
  const seen = new Set(readJSON<string[]>(SEEN_KEY, []));
  return current.announcements.filter(item => !seen.has(item.id));
}

export function markAnnouncementSeen(id: string): void {
  const seen = readJSON<string[]>(SEEN_KEY, []);
  if (seen.includes(id)) return;
  seen.push(id);
  // Liste sonsuza kadar büyümesin.
  writeJSON(SEEN_KEY, seen.slice(-200));
}
