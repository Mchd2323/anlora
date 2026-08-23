import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Anlora – Kaydırmalı kart destesi hareketi.
 *
 * Kart parmağı birebir takip eder; bırakıldığında ya bir sonrakine geçer ya da
 * yerine geri yaylanır. Tasarım kararları:
 *
 * 1. Pointer Events kullanılır: tek kod yolu fare, dokunmatik ve kalemi birden
 *    karşılar; ayrı mouse/touch dalları arasında davranış kayması olmaz.
 * 2. Eksen kilidi: ilk birkaç pikselde yön belirlenir. Dikey kaydırma başlarsa
 *    hareket bırakılır, böylece sayfa akışı kesilmez.
 * 3. Mesafe VEYA hız: kısa ama hızlı bir fiske de geçiş sayılır; kullanıcı
 *    kartı ekranın yarısına kadar sürüklemek zorunda kalmaz.
 * 4. Kapalı yönde direnç: desteninin sonundayken kart tamamen kilitli değil,
 *    lastik gibi az miktarda esner. Sınıra çarpıldığı hissedilir.
 * 5. `prefers-reduced-motion` açıksa çıkış animasyonu atlanır.
 */

export type SwipeDirection = 'left' | 'right';

/** Geçişi tetikleyen yatay mesafe (piksel). */
const COMMIT_DISTANCE = 88;
/** Geçişi tetikleyen fiske hızı (piksel/ms). */
const COMMIT_VELOCITY = 0.4;
/** Yön kilidi bu mesafeden sonra kararlaştırılır. */
const AXIS_LOCK = 8;
/** Kapalı yöne sürüklerken uygulanan sönümleme katsayısı. */
const RESISTANCE = 0.3;
/** Çıkış animasyonunun süresi; CSS ile aynı olmalı. */
export const SWIPE_EXIT_MS = 200;

export interface UseSwipeDeckOptions {
  /** Eşik aşıldığında çağrılır. */
  onSwipe: (direction: SwipeDirection) => void;
  /** Sola kaydırma (sonraki kart) mümkün mü? */
  canSwipeLeft: boolean;
  /** Sağa kaydırma (önceki kart) mümkün mü? */
  canSwipeRight: boolean;
  /** Hareketi tamamen kapatır. */
  disabled?: boolean;
}

export interface SwipeDeckState {
  /** Kartın anlık yatay ötelemesi. */
  offsetX: number;
  /** Kullanıcı şu anda sürüklüyor mu? */
  isDragging: boolean;
  /** Kart çıkış animasyonundaysa yönü, değilse null. */
  exitDirection: SwipeDirection | null;
  /**
   * Bırakıldığında geçişin gerçekleşeceği yön; henüz eşik aşılmadıysa null.
   * Arayüzdeki yön ipucunu göstermek için kullanılır.
   */
  intent: SwipeDirection | null;
  /** Sürükleme ilerlemesi (0–1); ipucu opaklığı için. */
  progress: number;
  /** Sürükleme yüzeyine yayılacak olay bağlayıcıları. */
  handlers: {
    onPointerDown: (event: React.PointerEvent) => void;
    onPointerMove: (event: React.PointerEvent) => void;
    onPointerUp: (event: React.PointerEvent) => void;
    onPointerCancel: (event: React.PointerEvent) => void;
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useSwipeDeck({
  onSwipe,
  canSwipeLeft,
  canSwipeRight,
  disabled = false
}: UseSwipeDeckOptions): SwipeDeckState {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(null);

  // Hareket boyunca değişen ama yeniden çizim gerektirmeyen değerler ref'te
  // tutulur; her pointermove'da state yazmak gereksiz render üretirdi.
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const axisRef = useRef<'undecided' | 'horizontal' | 'vertical'>('undecided');
  const activePointerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setOffsetX(0);
    setIsDragging(false);
    axisRef.current = 'undecided';
    activePointerRef.current = null;
    velocityRef.current = 0;
  }, []);

  const commit = useCallback(
    (direction: SwipeDirection) => {
      setIsDragging(false);
      activePointerRef.current = null;
      axisRef.current = 'undecided';

      if (prefersReducedMotion()) {
        setOffsetX(0);
        onSwipe(direction);
        return;
      }

      setExitDirection(direction);
      exitTimerRef.current = window.setTimeout(() => {
        onSwipe(direction);
        setExitDirection(null);
        setOffsetX(0);
        exitTimerRef.current = null;
      }, SWIPE_EXIT_MS);
    },
    [onSwipe]
  );

  const canGo = useCallback(
    (direction: SwipeDirection) => (direction === 'left' ? canSwipeLeft : canSwipeRight),
    [canSwipeLeft, canSwipeRight]
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (disabled || exitDirection) return;
      // Fare ile yalnızca sol tuş sürükler; sağ tuş menüsü bozulmasın.
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      activePointerRef.current = event.pointerId;
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      lastXRef.current = event.clientX;
      lastTimeRef.current = event.timeStamp;
      velocityRef.current = 0;
      axisRef.current = 'undecided';
    },
    [disabled, exitDirection]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (activePointerRef.current !== event.pointerId) return;
      if (axisRef.current === 'vertical') return;

      const dx = event.clientX - startXRef.current;
      const dy = event.clientY - startYRef.current;

      if (axisRef.current === 'undecided') {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        // Yatay hareket dikeyden belirgin biçimde baskınsa deste devralır;
        // aksi hâlde parmağı sayfaya bırakırız.
        if (Math.abs(dx) <= Math.abs(dy)) {
          axisRef.current = 'vertical';
          activePointerRef.current = null;
          return;
        }
        axisRef.current = 'horizontal';
        setIsDragging(true);
        // Sürükleme boyunca imleç kartı takip etsin; parmak kart sınırından
        // çıksa bile olaylar bize gelmeye devam eder.
        const target = event.currentTarget as HTMLElement;
        if (target.setPointerCapture) {
          try {
            target.setPointerCapture(event.pointerId);
          } catch {
            // Yakalama başarısız olursa sürükleme yine de çalışır.
          }
        }
      }

      const elapsed = event.timeStamp - lastTimeRef.current;
      if (elapsed > 0) {
        velocityRef.current = (event.clientX - lastXRef.current) / elapsed;
        lastXRef.current = event.clientX;
        lastTimeRef.current = event.timeStamp;
      }

      const direction: SwipeDirection = dx < 0 ? 'left' : 'right';
      setOffsetX(canGo(direction) ? dx : dx * RESISTANCE);
    },
    [canGo]
  );

  const finish = useCallback(
    (event: React.PointerEvent) => {
      if (activePointerRef.current !== event.pointerId) {
        // Yatay kilide hiç girmemiş bir dokunuş: temizle, geçiş yapma.
        if (axisRef.current !== 'horizontal') reset();
        return;
      }

      const dx = event.clientX - startXRef.current;
      const direction: SwipeDirection = dx < 0 ? 'left' : 'right';
      const flicked = Math.abs(velocityRef.current) >= COMMIT_VELOCITY;
      const dragged = Math.abs(dx) >= COMMIT_DISTANCE;

      if ((dragged || flicked) && canGo(direction)) {
        commit(direction);
        return;
      }

      reset();
    },
    [canGo, commit, reset]
  );

  const dx = offsetX;
  const direction: SwipeDirection | null = dx === 0 ? null : dx < 0 ? 'left' : 'right';
  const intent =
    direction && Math.abs(dx) >= COMMIT_DISTANCE && canGo(direction) ? direction : null;

  return {
    offsetX,
    isDragging,
    exitDirection,
    intent,
    progress: Math.min(Math.abs(dx) / COMMIT_DISTANCE, 1),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish
    }
  };
}
