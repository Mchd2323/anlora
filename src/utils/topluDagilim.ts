/**
 * Anlora – "Sözlükte olmayan kelimeler NEDEN yok?"
 *
 * NEDEN VAR. Kullanıcı 250 kelimelik bir liste yükledi, doksanı "sözlükte
 * yok" çıktı ve haklı olarak sözlüğün eksik olduğundan şüphelendi. Ölçtüm:
 * sözlük eksik değil (gündelik kırk kelimenin otuz sekizi var), listenin
 * kendisi kalıp ağırlıklıydı -- "split second", "mass production",
 * "waste basket" gibi iki sözcüklü ifadeler. Sözlükteki 20.751 kaydın
 * yalnızca dokuzunda boşluk var; çok sözcüklü ifadeler ayrı listede ve
 * orada 750 kalıp bulunuyor.
 *
 * Bu ayrımı kullanıcının GÖREBİLMESİ gerekiyor. "90 kelime sözlükte yok"
 * cümlesi tek başına sözlüğü suçlu gösteriyor; dökümü ise ne olduğunu
 * söylüyor ve kullanıcı listesini ona göre düzeltebiliyor (yazım hatasını
 * onarmak, çekimli biçim yerine kökü yazmak gibi).
 */

export interface DagilimGirdisi {
  status: string;
  cokKelimeli?: boolean;
  yazimOnerisi?: string[];
  kokBicimi?: string;
}

export interface Dagilim {
  /** Sözlükte bulunamayan toplam girdi. */
  toplam: number;
  /** Boşluk içeren girdiler: kalıp, deyim, öbek fiil. */
  cokSozcuklu: number;
  /** Yakın bir yazım bulundu: muhtemelen yazım hatası. */
  yazimSupheli: number;
  /** Kökü sözlükte olan çekimli biçim ("skidded" -> "skid"). */
  cekimli: number;
  /** Geriye kalan: gerçekten sözlükte olmayan tek sözcük. */
  tekSozcuk: number;
}

/**
 * Sözlükte bulunamayanların dökümünü çıkarır.
 *
 * Kategoriler ÇAKIŞMAZ: her girdi tam olarak bir kovaya düşer, yoksa
 * toplamları kullanıcının gördüğü sayıyı tutmaz ve döküm güven vermek
 * yerine kafa karıştırırdı. Sıra da anlamlı: çok sözcüklü olmak yazım
 * şüphesinden önce geliyor, çünkü iki sözcüklü bir ifadeye tek sözcüklük
 * yazım önerisi vermek zaten yanlış olurdu ("day off" için "payoff").
 */
export function yeniDagilimi(girdiler: DagilimGirdisi[]): Dagilim {
  const yeniler = girdiler.filter(g => g.status === 'NEW');
  let cokSozcuklu = 0;
  let yazimSupheli = 0;
  let cekimli = 0;

  for (const g of yeniler) {
    if (g.cokKelimeli) cokSozcuklu++;
    else if (g.yazimOnerisi && g.yazimOnerisi.length > 0) yazimSupheli++;
    else if (g.kokBicimi) cekimli++;
  }

  return {
    toplam: yeniler.length,
    cokSozcuklu,
    yazimSupheli,
    cekimli,
    tekSozcuk: yeniler.length - cokSozcuklu - yazimSupheli - cekimli
  };
}

/**
 * Dökümü tek satırlık okunur metne çevirir; boş kovalar yazılmaz.
 *
 * "2 tanesi" deniyor, "2'si" değil: Türkçede sayıya eklenen iyelik eki son
 * rakamın okunuşuna göre değişiyor (2'si, 3'ü, 6'sı, 90'ı) ve bunu kod
 * içinde kestirmeye çalışmak, ekranda bozuk ek üreten bir kural tablosu
 * demekti. "tane" her sayıyla doğru çalışıyor.
 */
export function dagilimMetni(d: Dagilim): string {
  const parcalar: string[] = [];
  if (d.cokSozcuklu) parcalar.push(`${d.cokSozcuklu} tanesi çok sözcüklü kalıp`);
  if (d.yazimSupheli) parcalar.push(`${d.yazimSupheli} tanesi yazım şüpheli`);
  if (d.cekimli) parcalar.push(`${d.cekimli} tanesi çekimli biçim`);
  if (d.tekSozcuk) parcalar.push(`${d.tekSozcuk} tanesi tek sözcük`);
  return parcalar.join(', ');
}
