import { describe, it, expect } from 'vitest';
import { cozTemayi } from '../useTheme';
import { ON_AYAR_KIMLIKLERI, ACIK_ON_AYARLAR, KOYU_ON_AYARLAR, onAyarModu } from '../../theme/realmsPresets';
import type { UserSettings } from '../../types';

const ayar = (o: Partial<UserSettings>) => o as UserSettings;

/**
 * Görünüm tercihi bugüne kadar dört kez model değiştirdi ve her modelin
 * değerleri kullanıcıların ayarlarında hâlâ kayıtlı. Bu testler kimsenin
 * ekranının geçişte bozulmadığını ve niyetinin korunduğunu doğruluyor.
 */
describe('görünüm tercihi', () => {
  it('dört ek tema tanımlı: ikisi açık, ikisi koyu', () => {
    expect(ACIK_ON_AYARLAR).toHaveLength(2);
    expect(KOYU_ON_AYARLAR).toHaveLength(2);
    expect(ON_AYAR_KIMLIKLERI).toHaveLength(4);
    for (const t of ACIK_ON_AYARLAR) expect(onAyarModu(t.id)).toBe('light');
    for (const t of KOYU_ON_AYARLAR) expect(onAyarModu(t.id)).toBe('dark');
  });

  it('hiç ayar yoksa Sistem gelir — taban görünüm değişmez', () => {
    expect(cozTemayi(ayar({}))).toBe('system');
    expect(cozTemayi(ayar({ themePreset: 'system' }))).toBe('system');
  });

  it('seçilen ek tema olduğu gibi kalır', () => {
    for (const id of ON_AYAR_KIMLIKLERI) {
      expect(cozTemayi(ayar({ themePreset: id }))).toBe(id);
    }
  });

  /**
   * EN ÖNEMLİ GEÇİŞ. Dört ek tema listeden çıkarıldı; onları seçmiş
   * kullanıcının ayarı telefonunda duruyor. Tanınmayan kimlik gibi 'system'e
   * düşselerdi, koyu tema seçmiş biri telefonu açıksa uygulamayı bir sabah
   * açık bulurdu. Eşleme hem MODU hem rengin havasını koruyor.
   */
  it('kaldırılan temalar aynı moddaki en yakın temaya düşer', () => {
    expect(cozTemayi(ayar({ themePreset: 'light-ancient-map' }))).toBe('light-crimson-dawn');
    expect(cozTemayi(ayar({ themePreset: 'light-grove-oath' }))).toBe('light-frost-crystal');
    expect(cozTemayi(ayar({ themePreset: 'dark-dragon-ember' }))).toBe('dark-crimson-night');
    expect(cozTemayi(ayar({ themePreset: 'dark-iron-grove' }))).toBe('dark-frost-watch');
  });

  it('kaldırılan temanın karşılığı hep aynı modda kalır', () => {
    const modlar: Record<string, 'light' | 'dark'> = {
      'light-ancient-map': 'light',
      'light-grove-oath': 'light',
      'dark-dragon-ember': 'dark',
      'dark-iron-grove': 'dark'
    };
    for (const [eski, mod] of Object.entries(modlar)) {
      const yeni = cozTemayi(ayar({ themePreset: eski }));
      expect(onAyarModu(yeni)).toBe(mod);
    }
  });

  /**
   * Üçüncü modelde "Açık" ve "Koyu" ayrı birer taban seçenekti; ikisi de
   * bugünkü onaylı görünümün ta kendisiydi, tek farkları telefonun ayarını
   * izlememeleriydi. Seçenek kalktı, görünüm durdu: ikisi de 'system'.
   * Ek temalardan birine yönlendirmek görünümü sessizce değiştirmek olurdu.
   */
  it('kaldırılan Açık/Koyu taban seçenekleri Sisteme düşer', () => {
    expect(cozTemayi(ayar({ themePreset: 'light' }))).toBe('system');
    expect(cozTemayi(ayar({ themePreset: 'dark' }))).toBe('system');
  });

  it('ikinci modelin modu da onaylı tabana eşlenir', () => {
    expect(cozTemayi(ayar({ themeMode: 'light' }))).toBe('system');
    expect(cozTemayi(ayar({ themeMode: 'dark' }))).toBe('system');
    expect(cozTemayi(ayar({ themeMode: 'system' }))).toBe('system');
    // Aile seçilmişti ama o katman artık yok; taban görünüm bozulmuyor.
    expect(cozTemayi(ayar({ themeMode: 'system', themeFamily: 'kizil-kale' }))).toBe('system');
  });

  it('ilk modelin sekiz ön ayarı da onaylı tabana eşlenir', () => {
    for (const eski of ['deniz', 'kum', 'gul', 'sis', 'lavanta', 'dark', 'orman', 'komur', 'system'] as const) {
      expect(cozTemayi(ayar({ theme: eski }))).toBe('system');
    }
  });

  it('yeni alan varsa eski alanlar artık okunmuyor', () => {
    expect(cozTemayi(ayar({ theme: 'orman', themeMode: 'light', themePreset: 'dark-frost-watch' })))
      .toBe('dark-frost-watch');
  });

  it('tanınmayan kimlik Sisteme düşer, ekran yarım tema ile kalmaz', () => {
    expect(cozTemayi(ayar({ themePreset: 'olmayan-tema' }))).toBe('system');
    expect(onAyarModu('olmayan-tema')).toBeNull();
  });
});
