import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Depolama sarmalayıcısı testleri.
 *
 * Önceki sürümde 25 ayrı yerde `localStorage.setItem` doğrudan çağrılıyordu.
 * Kota dolduğunda ya da tarayıcı depolamayı engellediğinde bu çağrı istisna
 * fırlatır ve uygulama çöker.
 */

class MemoryStorage {
  store = new Map<string, string>();
  failOnWrite = false;

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    if (this.failOnWrite && !key.startsWith('__anlora_probe__')) {
      throw new DOMException('Kota doldu', 'QuotaExceededError');
    }
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

const { readJSON, writeJSON, readRaw, writeRaw, removeKey, onStorageError } =
  await import('../safeStorage');

describe('safeStorage', () => {
  beforeEach(() => {
    storage.clear();
    storage.failOnWrite = false;
  });

  it('yazdığını geri okur', () => {
    writeJSON('k', { a: 1 });
    expect(readJSON('k', null)).toEqual({ a: 1 });
  });

  it('anahtar yoksa varsayılanı döner', () => {
    expect(readJSON('yok', [])).toEqual([]);
  });

  it('bozuk JSON varsayılana düşer, istisna fırlatmaz', () => {
    storage.setItem('k', '{bozuk');
    expect(() => readJSON('k', 'varsayilan')).not.toThrow();
    expect(readJSON('k', 'varsayilan')).toBe('varsayilan');
  });

  it('saklanan null değer varsayılana düşer', () => {
    storage.setItem('k', 'null');
    expect(readJSON('k', 'varsayilan')).toBe('varsayilan');
  });

  it('kota hatasında çökmez, false döner', () => {
    storage.failOnWrite = true;
    expect(() => writeJSON('k', { a: 1 })).not.toThrow();
    expect(writeJSON('k', { a: 1 })).toBe(false);
  });

  it('kota hatasında değeri en azından oturum boyunca korur', () => {
    storage.failOnWrite = true;
    writeJSON('k', { a: 1 });
    // Disk yazılamasa bile aynı oturumda okuma çalışmalı; aksi halde
    // kullanıcı yaptığı işin anında kaybolduğunu görür.
    expect(readJSON('k', null)).toEqual({ a: 1 });
  });

  it('kota hatasını dinleyicilere bildirir', () => {
    const seen: string[] = [];
    const unsubscribe = onStorageError((_err, key) => seen.push(key));
    storage.failOnWrite = true;
    writeJSON('dolu', { a: 1 });
    unsubscribe();
    expect(seen).toEqual(['dolu']);
  });

  it('döngüsel referansta çökmez', () => {
    const circular: any = {};
    circular.self = circular;
    expect(() => writeJSON('c', circular)).not.toThrow();
    expect(writeJSON('c', circular)).toBe(false);
  });

  it('ham dize yazıp okur', () => {
    writeRaw('flag', 'true');
    expect(readRaw('flag')).toBe('true');
  });

  it('anahtar siler', () => {
    writeJSON('k', 1);
    removeKey('k');
    expect(readRaw('k')).toBeNull();
  });
});
