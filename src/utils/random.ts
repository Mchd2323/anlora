/**
 * Rastgelelik yardımcıları.
 *
 * `Array.prototype.sort(() => 0.5 - Math.random())` yaygın ama HATALI bir
 * karıştırma yöntemidir: karşılaştırıcı tutarsız olduğu için sonuç düzgün
 * dağılmaz ve öğe konumları tahmin edilebilir hale gelir. Sınavda doğru
 * cevabın şıklar arasındaki yeri öngörülebilir olacağından bu gerçek bir
 * öğrenme sorunudur. Aşağıdaki Fisher-Yates uygulaması düzgün dağılım verir.
 */

/**
 * Diziyi yerinde değiştirmeden, düzgün dağılımlı biçimde karıştırır.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Diziden en fazla `count` adet öğeyi rastgele seçer.
 * Tüm diziyi karıştırmak yerine yalnızca gereken kadar takas yapar.
 */
export function sample<T>(items: readonly T[], count: number): T[] {
  if (count >= items.length) return shuffle(items);
  const pool = items.slice();
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    picked.push(pool[i]);
  }
  return picked;
}

/**
 * Diziden tek bir öğe seçer. Dizi boşsa `undefined` döner.
 */
export function pickOne<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}
