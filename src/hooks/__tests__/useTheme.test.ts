import { describe, it, expect } from 'vitest';
import { cozModu, cozAileyi } from '../useTheme';
import { VARSAYILAN_AILE, AILE_KIMLIKLERI } from '../../theme/realmsFamilies';
import type { UserSettings } from '../../types';

const ayar = (o: Partial<UserSettings>) => o as UserSettings;

/**
 * Tema seçimi tek listeden mod + aile ikilisine geçti. Kullanıcıların
 * ayarlarında ESKİ değerler kayıtlı; bu testler kimsenin ekranının
 * geçişte bozulmadığını doğruluyor.
 */
describe('tema geçişi', () => {
  it('eski açık ön ayarlar açık moda düşüyor', () => {
    for (const eski of ['deniz', 'kum', 'gul', 'sis', 'lavanta', 'light'] as const) {
      expect(cozModu(ayar({ theme: eski }))).toBe('light');
    }
  });

  it('eski koyu ön ayarlar koyu moda düşüyor', () => {
    for (const eski of ['dark', 'orman', 'komur'] as const) {
      expect(cozModu(ayar({ theme: eski }))).toBe('dark');
    }
  });

  it('sistem sistem kalıyor, hiç ayar yoksa da sistem', () => {
    expect(cozModu(ayar({ theme: 'system' }))).toBe('system');
    expect(cozModu(ayar({}))).toBe('system');
  });

  it('yeni alan varsa eski alan artık okunmuyor', () => {
    expect(cozModu(ayar({ theme: 'orman', themeMode: 'light' }))).toBe('light');
  });

  it('aile seçilmemişse varsayılan aile geliyor', () => {
    expect(cozAileyi(ayar({}))).toBe(VARSAYILAN_AILE);
    expect(cozAileyi(ayar({ theme: 'komur' }))).toBe(VARSAYILAN_AILE);
  });

  it('tanınmayan aile kimliği varsayılana düşüyor, ekran boş kalmıyor', () => {
    expect(cozAileyi(ayar({ themeFamily: 'olmayan-aile' }))).toBe(VARSAYILAN_AILE);
  });

  it('sekiz ailenin kimliği de kabul ediliyor', () => {
    for (const id of AILE_KIMLIKLERI) {
      expect(cozAileyi(ayar({ themeFamily: id }))).toBe(id);
    }
    expect(AILE_KIMLIKLERI).toHaveLength(8);
  });
});
