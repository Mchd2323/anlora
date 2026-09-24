import { WordCard } from '../types';
import { kalanlariBosEkle, kuyruguOku } from './topluKuyruk';

/**
 * Anlora – Eski toplu ekleme kuyruğunu boşaltır.
 *
 * NEDEN VAR. Toplu eklemede yapay zekâ kaldırıldı ve onunla birlikte arka
 * plan kuyruğu da kalktı. Ama kuyruk DİSKTE duruyor: kullanıcının telefonunda
 * bu sürümden önce başlatılmış, yarım kalmış bir liste olabilir. Kuyruğu
 * işleyen kod artık yok, yani o kelimeler hiçbir zaman eklenmez ve kullanıcı
 * bunu göremez -- sessizce kaybolurlar.
 *
 * Bu, yaşanmış bir durum: kullanıcının kuyruğunda altmış yedi kelime
 * takılıydı ve "0 hazır · 57 bekliyor" diye duruyordu.
 *
 * Kelimeler kart olarak ekleniyor, anlam alanı BOŞ bırakılıyor (uydurma veri
 * yazılmaz -- talimat 59). Kullanıcı sonra doldurur; hiçbiri kaybolmaz.
 *
 * Bir kez koşar: kuyruk silindiği için ikinci açılışta yapacak iş bulmaz.
 * Kartlardan biri diske düşmezse kuyruk BİLEREK duruyor ve iş sonraki
 * açılışta tekrarlanıyor -- bkz. `kalanlariBosEkle`.
 */
export function eskiKuyrugaTakilanlariKurtar(
  ekle: (kart: WordCard, setId: string) => boolean
): number {
  if (!kuyruguOku()) return 0;
  return kalanlariBosEkle(ekle);
}
