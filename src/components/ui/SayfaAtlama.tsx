import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Uzun listelerde sayfanın başına ve sonuna atlama.
 *
 * NEDEN VAR. Bir sette on kart biriktiğinde sayfa birkaç ekran boyuna
 * ulaşıyor ve kullanıcı sona ulaşmak için parmakla defalarca kaydırmak
 * zorunda kalıyordu. Oxford listelerinde durum daha da belirgin: orada
 * sayfa altmışar kartlık bloklar hâlinde uzuyor.
 *
 * NE ZAMAN GÖRÜNÜR. Yalnızca sayfa gerçekten uzunsa. Ölçüt bir kart sayısı
 * değil, sayfanın kendi yüksekliği: görünen alanın 1,8 katını aşınca
 * çiziliyor. Kart sayısına bağlamak yanlış olurdu — kartların yüksekliği
 * içeriğe göre değişiyor, üç uzun kart on kısa karttan fazla yer tutabiliyor.
 *
 * İKİ AYRI DÜĞME, TEK DEĞİL. Tek bir "yön değiştiren" düğme daha az yer
 * kaplardı ama kullanıcı basmadan hangi yöne gideceğini bilemezdi. İkisi de
 * her zaman görünür ve ne yaptıkları sabittir.
 *
 * ALT ÇUBUĞUN ÜSTÜNDE DURUYOR: `bottom` değeri `pb-safe-nav` ile aynı payı
 * kullanıyor, yoksa gezinme çubuğunun altında kalırdı.
 */
export const SayfaAtlama: React.FC = () => {
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    /*
     * Ölçüm hem kaydırırken hem de içerik değiştiğinde yenilenmeli: kelime
     * eklendikçe sayfa uzuyor ve düğme o anda belirmeli. `ResizeObserver`
     * belge yüksekliğini izliyor; kaydırma dinleyicisi edilgen (passive),
     * yani kaydırmayı hiçbir koşulda geciktirmiyor.
     */
    const olc = () => {
      const belge = document.documentElement;
      setGorunur(belge.scrollHeight > window.innerHeight * 1.8);
    };

    olc();
    window.addEventListener('scroll', olc, { passive: true });
    window.addEventListener('resize', olc);

    let gozlemci: ResizeObserver | null = null;
    try {
      gozlemci = new ResizeObserver(olc);
      gozlemci.observe(document.body);
    } catch {
      /* Tarayıcı desteklemiyorsa kaydırma ve yeniden boyutlandırma yeter. */
    }

    return () => {
      window.removeEventListener('scroll', olc);
      window.removeEventListener('resize', olc);
      gozlemci?.disconnect();
    };
  }, []);

  if (!gorunur) return null;

  const git = (hedef: number) => {
    // `smooth` uzun sayfada saniyelerce sürüyor; kullanıcı düğmeye "hemen
    // git" diye basıyor.
    window.scrollTo({ top: hedef, behavior: 'auto' });
  };

  const ortak =
    'w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] ' +
    'text-[var(--text-secondary)] hover:text-[var(--primary)] ' +
    'hover:bg-[var(--primary-soft)] shadow-[0_2px_8px_rgba(30,36,48,0.10)] ' +
    'flex items-center justify-center transition-colors cursor-pointer';

  return (
    <div
      className="fixed right-3 z-30 flex flex-col gap-1.5"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <button type="button" onClick={() => git(0)} className={ortak} aria-label="Sayfanın en üstüne git" title="En üste">
        <ChevronUp className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => git(document.documentElement.scrollHeight)}
        className={ortak}
        aria-label="Sayfanın en altına git"
        title="En alta"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
};
