import React from 'react';

/**
 * Ana sayfa görseli.
 *
 * NEDEN FOTOĞRAF DEĞİL: uygulama tamamen çevrimdışı çalışıyor. Stok
 * fotoğraflar hem paketi megabaytlarca şişirir hem de internetsiz açıldığında
 * boş kutu olarak görünür. Bu çizim SVG; birkaç kilobayt, her ekran
 * yoğunluğunda net ve tek bayt indirmeden çalışıyor.
 *
 * NE ANLATIYOR: uygulamanın vaadi. Üst üste duran kelime fişleri, en öndeki
 * kelimenin telaffuzu ve Türkçe karşılığıyla birlikte — yani "kelimeyi yaz,
 * anlamı ve örneği hazır gelsin". Petrol yeşili yalnızca burada ve sözlükte
 * kelime bulunduğu anda kullanılıyor; iki yerde de aynı şeyi söylüyor.
 *
 * Renkler CSS değişkenlerinden gelir, dolayısıyla karanlık modda kendiliğinden
 * uyum sağlar.
 */
export const HomeHeroArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="20 24 280 136"
    className={className}
    role="img"
    aria-label="Üst üste duran kelime kartları"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      {/* Kâğıt dokusu: ince yatay çizgiler, gerçek bir fişteki gibi. */}
      <pattern id="anlora-cizgi" width="8" height="8" patternUnits="userSpaceOnUse">
        <line x1="0" y1="7.5" x2="8" y2="7.5" stroke="var(--border-light)" strokeWidth="1" />
      </pattern>

      <linearGradient id="anlora-zemin" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--teal-soft)" />
        <stop offset="100%" stopColor="var(--primary-soft)" />
      </linearGradient>
    </defs>

    {/* Yumuşak zemin lekesi */}
    <ellipse cx="160" cy="96" rx="150" ry="76" fill="url(#anlora-zemin)" opacity="0.75" />

    {/* Arkadaki iki fiş: destenin devamı olduğunu gösterir */}
    <g opacity="0.55">
      <rect
        x="66" y="30" width="188" height="104" rx="14"
        fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"
        transform="rotate(-7 160 82)"
      />
    </g>
    <g opacity="0.8">
      <rect
        x="60" y="34" width="196" height="106" rx="14"
        fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"
        transform="rotate(-3.2 160 87)"
      />
    </g>

    {/* Öndeki fiş */}
    <g>
      <rect x="54" y="40" width="208" height="110" rx="15" fill="var(--surface)" />
      <rect x="54" y="40" width="208" height="110" rx="15" fill="url(#anlora-cizgi)" opacity="0.6" />
      <rect
        x="54" y="40" width="208" height="110" rx="15"
        fill="none" stroke="var(--border)" strokeWidth="1.5"
      />

      {/* Seviye rozeti */}
      <rect x="70" y="55" width="30" height="15" rx="5" fill="var(--primary-soft)" />
      <text
        x="85" y="66" textAnchor="middle"
        fontSize="9" fontWeight="700" fill="var(--primary)"
        fontFamily="system-ui, sans-serif"
      >
        B2
      </text>

      {/* Madde başı */}
      <text
        x="70" y="97"
        fontSize="27" fontWeight="800" fill="var(--text-primary)"
        fontFamily="system-ui, sans-serif" letterSpacing="-0.6"
      >
        thrive
      </text>

      {/* Telaffuz */}
      <text
        x="70" y="113"
        fontSize="10" fill="var(--text-secondary)"
        fontFamily="ui-monospace, monospace"
      >
        /θraɪv/
      </text>

      {/* Türkçe karşılık */}
      <text
        x="70" y="133"
        fontSize="12" fontWeight="600" fill="var(--text-primary)"
        fontFamily="system-ui, sans-serif"
      >
        gelişmek, serpilmek
      </text>

      {/* Sözlükte bulundu işareti — petrol yeşili yalnızca burada */}
      <g transform="translate(226 58)">
        <circle cx="10" cy="10" r="12" fill="var(--teal)" />
        <path
          d="M5 10.2l3.2 3.2L15.4 6.6"
          fill="none" stroke="var(--surface)" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </g>
    </g>

    {/* Üç örnek cümleyi temsil eden çizgiler */}
    <g opacity="0.9">
      <rect x="226" y="96" width="30" height="4" rx="2" fill="var(--teal-border)" />
      <rect x="226" y="106" width="22" height="4" rx="2" fill="var(--teal-border)" />
      <rect x="226" y="116" width="26" height="4" rx="2" fill="var(--teal-border)" />
    </g>
  </svg>
);
