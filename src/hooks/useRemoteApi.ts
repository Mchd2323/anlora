import { useEffect, useState } from 'react';
import { getApiCapabilities, yoklamayiTazele, type ApiCapabilities } from '../config/api';

/**
 * Sunucuya bağlı özellikler bu kurulumda var mı?
 *
 * NEDEN TEK KANCA. Uygulama üç biçimde dağıtılabiliyor: sunucusuz (mağazaya
 * çıkan çevrimdışı sürüm), tam sunuculu ve yalnızca yapay zekâyı karşılayan
 * Cloudflare vekili (`worker/`). Bu ayrımı her bileşenin kendi başına
 * yapması hem tekrar, hem de bir yerde unutulduğunda kullanıcıya basıldığında
 * hiçbir şey yapmayan bir düğme bırakır — ki bu, o düğmenin hiç olmamasından
 * kötüdür.
 *
 * NEDEN ÖZELLİK ADI SORULUYOR. Önceki sürüm tek bir soru soruyordu: "sunucu
 * var mı?". Bu, hesap ile yapay zekânın hep birlikte geldiğini varsayıyordu.
 * Cloudflare vekilinde yapay zekâ var ama hesap yok; tek boole o kurulumda
 * çalışmayan bir giriş düğmesi çizerdi.
 *
 * ÜÇ DURUM VARDIR, İKİ DEĞİL:
 *   null  → yoklama sürüyor. Arayüz bu sırada KARARSIZ olmalı; "yok" gibi
 *           davranıp sonra düğmeyi geri getirmek gözle görülür bir zıplama
 *           yaratır.
 *   true  → özellik karşılanıyor, açılabilir.
 *   false → karşılanmıyor; ona bağlı her şey hiç çizilmez.
 *
 * Yoklamanın kendisi `getApiCapabilities` içinde önbelleklenir: kancayı kaç
 * bileşen çağırırsa çağırsın ağa tek bir istek çıkar.
 */
export function useRemoteApi(
  ozellik: keyof ApiCapabilities = 'accounts'
): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const yokla = () => {
      void getApiCapabilities().then(yetenekler => {
        if (!cancelled) setAvailable(yetenekler[ozellik]);
      });
    };

    yokla();

    /*
     * UYGULAMA ÖN PLANA DÖNÜNCE YENİDEN YOKLANIYOR.
     *
     * Yoklama tek seferlikti ve başarısız olursa sonuç oturum boyunca "yok"
     * kalıyordu: telefonda anlık bir ağ kesintisi, tünel ya da Cloudflare
     * kopyasının soğuk başlaması Anlora AI'yı uygulama öldürülene kadar
     * kaybettiriyordu. Kullanıcının elinde bunu düzeltecek hiçbir düğme yoktu.
     *
     * Ön plana dönüş doğru an: kullanıcı telefonu cebinden çıkarmış, ağ
     * durumu değişmiş olabilir. Yalnızca sonuç OLUMSUZKEN yeniden yokluyoruz;
     * özellik zaten varsa sormanın anlamı yok.
     */
    const geriDonuldu = () => {
      if (document.visibilityState !== 'visible') return;
      setAvailable(onceki => {
        if (onceki === true) return onceki;
        yoklamayiTazele();
        yokla();
        return onceki;
      });
    };

    document.addEventListener('visibilitychange', geriDonuldu);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', geriDonuldu);
    };
  }, [ozellik]);

  return available;
}
