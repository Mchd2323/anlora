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

const { recordActivityForStreak, getUserStats, saveUserStats, createDefaultUserStats } =
  await import('../storageV2');

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
