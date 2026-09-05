import { describe, it, expect } from 'vitest';
import { cozTemayi } from '../useTheme';
import { ON_AYAR_KIMLIKLERI, ACIK_ON_AYARLAR, KOYU_ON_AYARLAR, onAyarModu } from '../../theme/realmsPresets';
import type { UserSettings } from '../../types';

const ayar = (o: Partial<UserSettings>) => o as UserSettings;

/**
 * Görünüm tercihi bugüne kadar üç kez model değiştirdi ve her modelin
 * değerleri kullanıcıların ayarlarında hâlâ kayıtlı. Bu testler kimsenin
 * ekranının geçişte bozulmadığını ve niyetinin korunduğunu doğruluyor.
 */
describe('görünüm tercihi', () => {
  it('sekiz ek tema tanımlı: dördü açık, dördü koyu', () => {
    expect(ACIK_ON_AYARLAR).toHaveLength(4);
    expect(KOYU_ON_AYARLAR).toHaveLength(4);
    expect(ON_AYAR_KIMLIKLERI).toHaveLength(8);
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

  it('ikinci modelin modu niyetine göre eşlenir', () => {
    // Açık seçmiş kullanıcı açık kalır, koyu seçmiş koyu kalır.
    expect(onAyarModu(cozTemayi(ayar({ themeMode: 'light' })) as string)).toBe('light');
    expect(onAyarModu(cozTemayi(ayar({ themeMode: 'dark' })) as string)).toBe('dark');
    expect(cozTemayi(ayar({ themeMode: 'system' }))).toBe('system');
  });

  it('ikinci modelin tema ailesi tercihi Sistemi bozmaz', () => {
    // Aile seçilmişti ama mod "sistem"di: kullanıcı sistemi izlemek istiyordu.
    expect(cozTemayi(ayar({ themeMode: 'system', themeFamily: 'kizil-kale' }))).toBe('system');
  });

  it('ilk modelin sekiz ön ayarı da niyetine göre eşlenir', () => {
    for (const eski of ['deniz', 'kum', 'gul', 'sis', 'lavanta', 'light'] as const) {
      expect(onAyarModu(cozTemayi(ayar({ theme: eski })) as string)).toBe('light');
    }
    for (const eski of ['dark', 'orman', 'komur'] as const) {
      expect(onAyarModu(cozTemayi(ayar({ theme: eski })) as string)).toBe('dark');
    }
    expect(cozTemayi(ayar({ theme: 'system' }))).toBe('system');
  });

  it('yeni alan varsa eski alanlar artık okunmuyor', () => {
    expect(cozTemayi(ayar({ theme: 'orman', themeMode: 'light', themePreset: 'light-grove-oath' })))
      .toBe('light-grove-oath');
  });

  it('tanınmayan kimlik Sisteme düşer, ekran yarım tema ile kalmaz', () => {
    expect(cozTemayi(ayar({ themePreset: 'olmayan-tema' }))).toBe('system');
    expect(onAyarModu('olmayan-tema')).toBeNull();
  });
});
