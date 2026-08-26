import { useEffect } from 'react';

/**
 * Uygulama geneli klavye kısayolları.
 *
 * NEDEN GEREKLİ: kelime çalışmak tekrarlı bir iş. Fareyle her seferinde
 * "Öğrendim" düğmesini aramak, yüz kelimede yüz kez nişan almak demek.
 * Klavye bunu tek tuşa indiriyor.
 *
 * YAZARKEN DEVREDE DEĞİL: kullanıcı bir metin alanına yazıyorsa kısayollar
 * çalışmaz; aksi hâlde "o" harfini yazmak sekme değiştirirdi. Değiştirici
 * tuşlarla (Ctrl/Cmd/Alt) basılan kombinasyonlar da tarayıcının kendi
 * kısayollarıdır, onlara dokunulmaz.
 */

export interface Shortcut {
  /** Küçük harf tuş adı: 'a', '1', '?' … */
  key: string;
  /** Ne yaptığı; yardım listesinde gösterilir. */
  description: string;
  run: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handle = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      // Açık bir iletişim kutusu varsa kısayollar susar: modalin kendi
      // klavye davranışı (Escape, Tab tuzağı) öne geçmeli.
      if (document.querySelector('[role="dialog"]')) return;

      const match = shortcuts.find(item => item.key === event.key.toLowerCase());
      if (!match) return;

      event.preventDefault();
      match.run();
    };

    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [shortcuts, enabled]);
}
