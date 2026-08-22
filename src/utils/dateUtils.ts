/**
 * Yerel gün sınırı yardımcıları.
 *
 * Aralıklı tekrar sistemleri gün bazında çalışır: "1 gün sonra tekrar",
 * "yarın herhangi bir saatte" demektir. Tarihe doğrudan gün eklemek saat
 * bilgisini koruduğu için akşam 23:00'te çalışılan bir kelime ertesi gün
 * ancak 23:00'te tekrara açılır ve kullanıcı gün boyu "bugün tekrar yok"
 * görür. Aşağıdaki yardımcılar tüm zamanlamayı yerel gün başlangıcına
 * sabitleyerek bunu önler.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Verilen tarihin yerel saat diliminde gün başlangıcı (00:00). */
export function startOfDay(date: Date | string | number = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Bugünün yerel gün başlangıcına `days` gün ekler. */
export function addDaysToStartOfDay(days: number, from: Date | string | number = new Date()): Date {
  const d = startOfDay(from);
  d.setDate(d.getDate() + days);
  return d;
}

/** Yerel takvime göre iki tarih arasındaki tam gün farkı. */
export function differenceInCalendarDays(
  later: Date | string | number,
  earlier: Date | string | number
): number {
  const a = startOfDay(later).getTime();
  const b = startOfDay(earlier).getTime();
  return Math.round((a - b) / MS_PER_DAY);
}

/** İki tarih aynı yerel güne mi düşüyor? */
export function isSameDay(a: Date | string | number, b: Date | string | number): boolean {
  return differenceInCalendarDays(a, b) === 0;
}

/** ISO tarih dizesi geçerli mi? */
export function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return false;
  }
  return !Number.isNaN(new Date(value as string).getTime());
}
