import { useCallback, useRef } from 'react';

/**
 * Anlora – Dokunuşun kaybolmadığı düğme etkinleştirmesi.
 *
 * ÖLÇÜLEN SORUN. Kullanıcı: "birkaç kart kaydırdıktan sonra Öğrendim
 * düğmesine iki kere basmak gerekiyor." Kartın kaydırılmasıyla ilgisi yok;
 * tarayıcının kendi davranışı.
 *
 * ÖLÇÜM (Chromium, dokunmatik olaylar, gerçek parmak gibi):
 *   - Sürükleme YOKKEN art arda dokunuşlar: 5/5 çalışıyor.
 *   - Yatay bir sürüklemeden HEMEN sonraki dokunuş: `pointerdown` ve
 *     `pointerup` geliyor ama `click` HİÇ DOĞMUYOR. 0 / 80 / 150 / 250 ms
 *     sonra hep yutuluyor, 400 ms sonra çalışıyor.
 *   - Aynı şey uygulamadan bağımsız, ÇIPLAK bir sayfada da oluyor (React
 *     yok, uygulama kodu yok, yalnızca `touch-action: pan-y` bir yüzey ve
 *     bir düğme): 3 ölçümün üçünde de aynı. Yani bu bizim hatamız değil,
 *     tarayıcının sürükleme sonrası tıklama bastırması.
 *
 * ÇÖZÜM. Düğme yalnızca `click`e güvenmiyor. Parmak KIPIRDAMADAN kalktıysa
 * (`pointerup`, kayma toleransı içinde) eylem orada çalışıyor; tarayıcı
 * ardından bir `click` üretirse o yok sayılıyor. Klavye ve fare yolları
 * değişmiyor: ikisinde de `click` normal biçimde gelir.
 *
 * NEDEN `pointerup` DE OLSA GÜVENLİ. Pointer olayları bastırılmıyor --
 * ölçümde ikisi de eksiksiz geldi. Çift çalışmayı zaman karşılaştırması
 * önlüyor.
 *
 * ZAMAN OLAYDAN DEĞİL, KENDİ SAATİMİZDEN OKUNUYOR. İlk yazımda
 * `event.timeStamp` kullanılmıştı ve ölçümde yakalandı: eylem iki kez
 * çalışıyor, anlam açılıp hemen kapanıyordu. Dokunuştan türetilen `click`
 * olayının damgası, kendisini doğuran `pointerup`ınkiyle aynı ölçeğe
 * oturmuyor; iki damgayı çıkarmak anlamsız bir sayı veriyor. `performance.now()`
 * her iki yerde de aynı saatten okunuyor, dolayısıyla fark gerçek.
 */

/** Dokunuşun "kaydırma değil, basış" sayıldığı en büyük kayma (piksel). */
const DOKUNUS_KAYMA = 10;

/**
 * `pointerup` ile çalışan eylemin ardından gelen `click` bu süre içinde
 * yok sayılır. Tarayıcının tıklamayı üretme gecikmesi ölçümde 3-5 ms
 * civarındaydı; pencere yine de geniş tutuldu, çünkü yavaş cihazda bu süre
 * uzar ve iki kez çalışan bir "Öğrendim" düğmesi kendini geri alır.
 */
const YINELEME_PENCERESI_MS = 700;

export interface DokunusAktivasyonu {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onClick: (event: React.MouseEvent) => void;
}

export function useDokunusAktivasyonu(
  eylem: (event: React.SyntheticEvent) => void
): DokunusAktivasyonu {
  const baslangicRef = useRef<{ x: number; y: number } | null>(null);
  const sonCalismaRef = useRef(0);
  const eylemRef = useRef(eylem);
  eylemRef.current = eylem;

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    baslangicRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    /*
     * Fare ve kalem dışarıda: onlarda `click` zaten güvenilir biçimde geliyor
     * ve burada da çalıştırmak eylemi iki kez tetiklemeye açık kapı bırakır.
     * Bastırma yalnızca dokunmatikte görüldü.
     */
    if (event.pointerType !== 'touch') return;

    const baslangic = baslangicRef.current;
    baslangicRef.current = null;
    if (!baslangic) return;

    // Parmak kaydıysa bu bir basış değil; kaydırma olabilir, karışılmaz.
    const kayma = Math.hypot(event.clientX - baslangic.x, event.clientY - baslangic.y);
    if (kayma > DOKUNUS_KAYMA) return;

    sonCalismaRef.current = performance.now();
    eylemRef.current(event);
  }, []);

  const onClick = useCallback((event: React.MouseEvent) => {
    const simdi = performance.now();
    // `pointerup` az önce çalıştırdıysa bu tıklama aynı basışın ikinci yüzü.
    if (sonCalismaRef.current && simdi - sonCalismaRef.current < YINELEME_PENCERESI_MS) return;
    eylemRef.current(event);
  }, []);

  return { onPointerDown, onPointerUp, onClick };
}
