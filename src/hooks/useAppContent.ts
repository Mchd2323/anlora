import { useEffect, useState } from 'react';
import {
  AppContent,
  getAppContent,
  subscribeAppContent,
  refreshAppContent
} from '../services/appContent';

/**
 * Sunucudan gelen içeriği bileşenlere verir.
 *
 * İlk değer önbellekten gelir; ağ beklenmez. Böylece uygulama çevrimdışı
 * açıldığında da son bilinen marka metinleriyle çizilir.
 */
export function useAppContent(): AppContent {
  const [content, setContent] = useState<AppContent>(getAppContent);

  useEffect(() => {
    const unsubscribe = subscribeAppContent(setContent);
    void refreshAppContent();
    return unsubscribe;
  }, []);

  return content;
}
