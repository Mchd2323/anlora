import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Seri (streak) mantığı testleri.
 *
 * Önceki sürümde `streakDays` hiçbir yerde artırılmıyordu: sabit 1 yazılıyor,
 * arayüzde "1 Gün" olarak gösteriliyor ve "3 günlük seri" rozeti bu yüzden
 * hiç açılamıyordu.
 */

// storageV2 tarayıcı depolamasına ihtiyaç duyar; basit bir bellek içi taklit.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const storage = new MemoryStorage();
vi.stubGlobal('localStorage', storage);

const {
  recordActivityForStreak,
  getUserStats,
  saveUserStats,
  createDefaultUserStats,
  getCurrentStreak,
  streakCountedToday
} = await import('../storageV2');

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe('recordActivityForStreak', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('ilk çalışmada seriyi 1 yapar', () => {
    const stats = recordActivityForStreak();
    expect(stats.streakDays).toBe(1);
  });

  it('aynı gün ikinci çalışma seriyi artırmaz', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 4, lastActiveDate: new Date().toISOString() });
    expect(recordActivityForStreak().streakDays).toBe(4);
    expect(recordActivityForStreak().streakDays).toBe(4);
  });

  it('ertesi gün çalışınca seri bir artar', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 4, lastActiveDate: daysAgo(1) });
    expect(recordActivityForStreak().streakDays).toBe(5);
  });

  it('bir gün atlanınca seri sıfırlanıp yeniden başlar', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 9, lastActiveDate: daysAgo(3) });
    expect(recordActivityForStreak().streakDays).toBe(1);
  });

  it('bozuk son etkinlik tarihinde çökmez', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 5, lastActiveDate: 'gecersiz-tarih' });
    expect(recordActivityForStreak().streakDays).toBe(1);
  });

  it('son etkinlik tarihini günceller', () => {
    recordActivityForStreak();
    const stats = getUserStats();
    expect(new Date(stats.lastActiveDate).getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it('cihaz saati geriye alınsa bile seriyi silmez', () => {
    const future = new Date();
    future.setDate(future.getDate() + 2);
    saveUserStats({ ...createDefaultUserStats(), streakDays: 7, lastActiveDate: future.toISOString() });
    expect(recordActivityForStreak().streakDays).toBe(7);
  });
});

describe('getUserStats', () => {
  beforeEach(() => storage.clear());

  it('eski sürümden gelen eksik alanları varsayılanla tamamlar', () => {
    // Yeni alan eklendiğinde eski kayıt `undefined` döndürüp arayüzde
    // "undefined" göstermemeli.
    storage.setItem('lexiflow_v2_stats', JSON.stringify({ totalCorrect: 12 }));
    const stats = getUserStats();
    expect(stats.totalCorrect).toBe(12);
    expect(stats.bestQuizAccuracy).toBe(0);
    expect(stats.mistakesMap).toEqual({});
  });

  it("bozuk JSON verisinde varsayılana döner", () => {
    storage.setItem('lexiflow_v2_stats', '{bozuk');
    expect(getUserStats().totalCorrect).toBe(0);
  });
});

/**
 * Saklanan seri ile O AN GEÇERLİ seri farklı şeylerdir.
 *
 * `streakDays` yalnızca çalışıldığında güncelleniyor; kullanıcı birkaç gün
 * uğramazsa alan son çalıştığı günkü değerde kalıyor. Ekran o değeri olduğu
 * gibi gösterince kopmuş bir seri yaşıyormuş gibi görünüyordu — kullanıcının
 * bildirdiği hata buydu: üç gün girmediği hâlde "1 gündür aralıksız".
 */
describe('getCurrentStreak', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('hiç çalışılmamışsa 0 döner', () => {
    expect(getCurrentStreak()).toBe(0);
  });

  it('bugün çalışılmışsa saklanan seriyi döner', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 5, lastActiveDate: daysAgo(0) });
    expect(getCurrentStreak()).toBe(5);
  });

  it('dün çalışılmışsa seri hâlâ ayaktadır', () => {
    // Kullanıcının bugünü henüz bitmedi; bugün çalışırsa seri devam eder.
    saveUserStats({ ...createDefaultUserStats(), streakDays: 5, lastActiveDate: daysAgo(1) });
    expect(getCurrentStreak()).toBe(5);
  });

  it('iki gün önce çalışılmışsa seri KOPMUŞTUR', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 5, lastActiveDate: daysAgo(2) });
    expect(getCurrentStreak()).toBe(0);
  });

  it('kullanıcının bildirdiği durum: üç gün uğramamış, seri 1 görünüyordu', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 1, lastActiveDate: daysAgo(3) });
    expect(getCurrentStreak()).toBe(0);
  });
});

describe('streakCountedToday', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('bugün çalışılmışsa true', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 2, lastActiveDate: daysAgo(0) });
    expect(streakCountedToday()).toBe(true);
  });

  it('dün çalışılmışsa false — bugün hâlâ çalışılabilir', () => {
    saveUserStats({ ...createDefaultUserStats(), streakDays: 2, lastActiveDate: daysAgo(1) });
    expect(streakCountedToday()).toBe(false);
  });
});

/**
 * Seri kazanılır, hediye edilmez.
 *
 * Kurulumda `streakDays: 1` ve `lastActiveDate: şimdi` yazılıyordu; uygulamayı
 * ilk açan, tek kart bile çalışmamış kullanıcı "1 gündür aralıksız" görüyordu.
 */
describe('yeni kurulum', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('hiç çalışmamış kullanıcının serisi 0’dır', () => {
    const stats = createDefaultUserStats();
    expect(stats.streakDays).toBe(0);
    expect(stats.lastActiveDate).toBe('');
    saveUserStats(stats);
    expect(getCurrentStreak()).toBe(0);
  });

  it('ilk kart çalışıldığında seri 1 olur', () => {
    saveUserStats(createDefaultUserStats());
    expect(getCurrentStreak()).toBe(0);
    recordActivityForStreak();
    expect(getCurrentStreak()).toBe(1);
  });
});
