import React, { useEffect, useRef, useState } from 'react';
import { getAppContent, subscribeAppContent } from '../services/appContent';

/**
 * Reklam alanı.
 *
 * BOŞSA HİÇ ÇİZİLMEZ. Yönetici o alana kod eklemediyse ya da alanı
 * kapattıysa bileşen `null` döner: ne çerçeve, ne boşluk, ne "reklam alanı"
 * yazısı. Reklamsız uygulamanın reklamsız görünmesi gerekir.
 *
 * SCRIPT ÇALIŞTIRMA. Reklam ağlarının verdiği kod neredeyse her zaman bir
 * `<script>` etiketi içerir ve `innerHTML` ile eklenen script çalışmaz —
 * tarayıcı bunu bilerek engeller. Bu yüzden eklenen kodun script etiketleri
 * yeniden oluşturulup DOM'a konur.
 *
 * Bu, yönetici hesabının ele geçirilmesini uygulamaya kod enjekte etmekle
 * eşdeğer kılar; reklam göstermenin başka bir yolu yok. Karşılığında yetki
 * ortam değişkenine bağlı ve panel yalnızca doğrulanmış yönetici hesabına
 * açık tutuluyor.
 */
export const AdSlot: React.FC<{ slot: string; className?: string }> = ({ slot, className = '' }) => {
  const [html, setHtml] = useState<string>(() => getAppContent().ads[slot] || '');
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeAppContent(content => setHtml(content.ads[slot] || ''));
  }, [slot]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';
    if (!html) return;

    const template = document.createElement('template');
    template.innerHTML = html;

    Array.from(template.content.childNodes).forEach(node => {
      if (node.nodeName === 'SCRIPT') {
        const source = node as HTMLScriptElement;
        const script = document.createElement('script');
        Array.from(source.attributes).forEach(attr =>
          script.setAttribute(attr.name, attr.value)
        );
        script.text = source.text;
        host.appendChild(script);
      } else {
        host.appendChild(node.cloneNode(true));
      }
    });

    return () => {
      host.innerHTML = '';
    };
  }, [html]);

  if (!html) return null;

  return (
    <div
      ref={hostRef}
      className={`overflow-hidden ${className}`}
      // Reklam içeriği ekran okuyucular için gezinmeyi zorlaştırmasın.
      aria-label="Reklam"
      role="complementary"
    />
  );
};
