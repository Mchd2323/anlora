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

/**
 * Sunucusuz kurulumda içeriğin geldiği STATİK adres.
 *
 * Sunucusu olmayan bir dağıtımda da kullanıcıya bir şey duyurabilmek gerekir:
 * "yeni sürüm çıktı", "şu kelimedeki hata düzeltildi" gibi. Tek gereken,
 * herkesin okuyabildiği bir JSON dosyası — ücretsiz bir statik barındırma
 * (örneğin GitHub Pages) bu iş için yeter, çalışan bir sunucuya gerek yok.
 *
 * Dosyayı güncellemek duyuruyu yayınlamak demektir; mağaza güncellemesi
 * gerekmez. Beklenen biçim `content/app-content.json` dosyasındadır.
 *
 * Tanımlı değilse hiçbir istek çıkmaz ve uygulama duyurusuz çalışır.
 */
const STATIC_CONTENT_URL = (import.meta.env.VITE_CONTENT_URL || '').trim();

/**
 * Gelen ham veriyi güvenli bir `AppContent`e çevirir.
 *
 * Kaynak ne olursa olsun (sunucu ya da statik dosya) veriye güvenilmez:
 * eksik, fazla ya da yanlış tipte alanlar gelebilir. Beklenmeyen her şey
 * sessizce boşa düşer — duyuru yüzünden uygulama çökmemeli.
 */
function normalizeContent(data: any): AppContent {
  return {
    ads: data?.ads && typeof data.ads === 'object' ? data.ads : {},
    announcements: Array.isArray(data?.announcements) ? data.announcements : [],
    branding: data?.branding && typeof data.branding === 'object' ? data.branding : {}
  };
}

/**
 * Bir adresten içerik çeker. Başarısızlık `null` döner, asla `throw` etmez.
 *
 * JSON denetimi şart: sunucu yokken Capacitor kendi `index.html`ini 200 ile
 * döndürür, statik barındırma da bulunamayan dosya için HTML hata sayfası
 * verebilir. İkisi de "içerik yok" demektir, hata değil.
 */
async function fetchContent(url: string, token?: string | null): Promise<AppContent | null> {
  try {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    return normalizeContent(await response.json());
  } catch {
    return null;
  }
}

/**
 * İçeriği tazeler. Başarısız olursa elde ne varsa onunla devam edilir.
 *
 * İKİ KAYNAK, SIRAYLA. Önce sunucu denenir; yanıt verirse söz onundur —
 * yönetim panelinden yapılan değişiklik statik dosyadan tazedir. Sunucu
 * yoksa ya da yanıt vermezse statik adrese düşülür. İkisi de yoksa
 * önbellekteki içerik olduğu gibi kalır.
 */
export async function refreshAppContent(): Promise<void> {
  const fromServer = await fetchContent(apiUrl('/api/app-content'), getSessionToken());
  if (fromServer) {
    publish(fromServer);
    return;
  }

  if (!STATIC_CONTENT_URL) return;

  const fromStatic = await fetchContent(STATIC_CONTENT_URL);
  if (fromStatic) publish(fromStatic);
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
