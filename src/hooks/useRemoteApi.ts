import { useEffect, useState } from 'react';
import { hasRemoteApi } from '../config/api';

/**
 * Sunucuya bağlı özellikler bu kurulumda var mı?
 *
 * NEDEN TEK BİR KANCA. Uygulama iki farklı biçimde dağıtılabiliyor: sunucusuz
 * (mağazaya çıkan çevrimdışı sürüm) ve sunuculu. Hesap, bulut yedeği, anlık
 * bildirim ve yönetim paneli yalnızca ikincisinde çalışır. Bu ayrımı her
 * bileşenin kendi başına yapması hem tekrar, hem de bir yerde unutulduğunda
 * kullanıcıya basıldığında hiçbir şey yapmayan bir düğme bırakır — ki bu,
 * o düğmenin hiç olmamasından kötüdür.
 *
 * ÜÇ DURUM VARDIR, İKİ DEĞİL:
 *   null  → yoklama sürüyor. Arayüz bu sırada KARARSIZ olmalı; "yok" gibi
 *           davranıp sonra düğmeyi geri getirmek gözle görülür bir zıplama
 *           yaratır.
 *   true  → sunucu yanıt verdi, özellikler açılabilir.
 *   false → sunucu yok; sunucuya bağlı her şey hiç çizilmez.
 *
 * Yoklamanın kendisi `hasRemoteApi` içinde önbelleklenir: kancayı kaç bileşen
 * çağırırsa çağırsın ağa tek bir istek çıkar.
 */
export function useRemoteApi(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasRemoteApi().then(ok => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
