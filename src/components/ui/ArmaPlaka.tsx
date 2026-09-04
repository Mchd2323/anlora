import React from 'react';
import logo from '../../assets/brand/anlora-realms-logo.png';
import kalkan from '../../assets/themes/realms/ornaments/crest-plaque.svg';

/**
 * Anlora armasi: logoyu tasiyan lacivert-altin kalkan plakasi.
 *
 * KALKAN PAKETTEN GELIYOR. Onceki surumde kalkani elle SVG olarak cizmistim;
 * master paketi kendi `crest-plaque.svg` dosyasini veriyor ve onu daha basit
 * bir cizimle yeniden uretmeyi acikca yasakliyor. Bu yuzden plaka artik bir
 * arka plan gorseli, bileşende cizim yok.
 *
 * OLCU. Paket plaka icin 38 x 44 piksel soyluyor — kalkan kare degil, dikey.
 * Logonun kalkan alani icindeki yerlesimi de paketten: ustten 9, yanlardan 8,
 * alttan 10 piksel bosluk. Logonun kendisine dokunulmuyor: kirpilmiyor,
 * renklendirilmiyor, `object-contain` ile orani korunuyor.
 */

interface Props {
  /** Plakanin genisligi (piksel). Yukseklik oranli hesaplanir: 44/38. */
  genislik?: number;
  className?: string;
}

/** Paketin verdigi plaka orani (64 x 72 viewBox -> 38 x 44 gorunur olcu). */
const ORAN = 44 / 38;

export const ArmaPlaka: React.FC<Props> = ({ genislik = 38, className = '' }) => {
  const yukseklik = Math.round(genislik * ORAN);
  const k = genislik / 38; // paketin olculerini oranli buyutmek icin

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{
        width: genislik,
        height: yukseklik,
        /*
         * Adres TIRNAK ICINDE olmali. Vite bu kucuk SVG'yi veri adresi olarak
         * gomuyor ve adres, SVG'nin kendi ozniteliklerinden gelen TEK TIRNAK
         * karakterleri tasiyor; tirnaksiz bir url() bunu ayristiramiyor ve
         * kalkan hic cizilmiyordu (ekranda goruldu: logo ciplak kaliyordu).
         */
        background: `url("${kalkan}") center / contain no-repeat`
      }}
      aria-hidden="true"
    >
      <img
        src={logo}
        alt=""
        decoding="async"
        className="absolute object-contain"
        style={{
          top: 9 * k,
          left: 8 * k,
          right: 8 * k,
          bottom: 10 * k,
          width: `calc(100% - ${16 * k}px)`,
          height: `calc(100% - ${19 * k}px)`
        }}
      />
    </span>
  );
};
