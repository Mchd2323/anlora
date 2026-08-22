import { describe, it, expect } from 'vitest';
import {
  startOfDay,
  addDaysToStartOfDay,
  differenceInCalendarDays,
  isSameDay,
  isValidDate
} from '../dateUtils';

describe('startOfDay', () => {
  it('saat bilgisini sıfırlar', () => {
    const d = startOfDay(new Date(2026, 0, 15, 23, 45, 30));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(15);
  });
});

describe('addDaysToStartOfDay', () => {
  it('gece yarısına sabitlenmiş hedef gün döner', () => {
    const base = new Date(2026, 0, 15, 23, 45);
    const result = addDaysToStartOfDay(1, base);
    expect(result.getDate()).toBe(16);
    expect(result.getHours()).toBe(0);
  });

  it('ay sınırını doğru geçer', () => {
    const result = addDaysToStartOfDay(1, new Date(2026, 0, 31, 12, 0));
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(1);
  });
});

describe('differenceInCalendarDays', () => {
  it('saat farkını değil takvim gününü sayar', () => {
    // 23:00 ile ertesi sabah 07:00 arası 8 saat ama bir takvim günüdür.
    const evening = new Date(2026, 0, 15, 23, 0);
    const morning = new Date(2026, 0, 16, 7, 0);
    expect(differenceInCalendarDays(morning, evening)).toBe(1);
  });

  it('aynı gün için sıfır döner', () => {
    expect(differenceInCalendarDays(new Date(2026, 0, 15, 1), new Date(2026, 0, 15, 23))).toBe(0);
  });
});

describe('isSameDay', () => {
  it('aynı günün farklı saatlerini eşit sayar', () => {
    expect(isSameDay(new Date(2026, 0, 15, 0, 1), new Date(2026, 0, 15, 23, 59))).toBe(true);
  });
});

describe('isValidDate', () => {
  it('bozuk değerleri reddeder', () => {
    expect(isValidDate('gecersiz')).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate(new Date().toISOString())).toBe(true);
  });
});
