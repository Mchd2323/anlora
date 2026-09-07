import { describe, expect, it } from 'vitest';
import { parseCapabilities } from '../api';

/**
 * Yetenek yoklamasının davranışı.
 *
 * Buradaki asıl karar geriye dönük uyumluluk: bu ayrımdan ÖNCE dağıtılmış bir
 * Express sunucusu `capabilities` alanını hiç göndermez ama her şeyi
 * karşılar. Alanın yokluğunu "hiçbiri" saymak, çalışan bir kurulumda hesap ve
 * yapay zekâyı sessizce kapatırdı — kullanıcı için görünür bir gerileme.
 */
describe('parseCapabilities', () => {
  it('alan bildirilmemişse hepsini karşılandı sayar', () => {
    expect(parseCapabilities({ ok: true })).toEqual({
      ai: true,
      accounts: true,
      sync: true,
      admin: true,
    });
  });

  it('Cloudflare vekilinin bildirimini olduğu gibi okur', () => {
    expect(
      parseCapabilities({
        ok: true,
        capabilities: { ai: true, accounts: false, sync: false, admin: false },
      })
    ).toEqual({ ai: true, accounts: false, sync: false, admin: false });
  });

  it('anahtarı bildirilmemiş özelliği kapatmaz', () => {
    // Yalnızca `accounts` bildirilmiş: ötekiler için sunucunun sessizliği
    // "yok" demek değildir.
    expect(parseCapabilities({ ok: true, capabilities: { accounts: false } })).toEqual({
      ai: true,
      accounts: false,
      sync: true,
      admin: true,
    });
  });

  it('anahtar yalnızca açıkça false ise kapanır', () => {
    expect(
      parseCapabilities({ ok: true, capabilities: { ai: 0, accounts: null } })
    ).toEqual({ ai: true, accounts: true, sync: true, admin: true });
  });

  it('capabilities bir nesne değilse hepsini karşılandı sayar', () => {
    expect(parseCapabilities({ ok: true, capabilities: 'evet' })).toEqual({
      ai: true,
      accounts: true,
      sync: true,
      admin: true,
    });
  });
});
