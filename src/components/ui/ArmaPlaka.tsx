import React from 'react';
import logo from '../../assets/brand/anlora-realms-logo.png';

/**
 * Anlora armasi: logoyu tasiyan lacivert-altin kalkan plakasi.
 *
 * NEDEN KUTU DEGIL. Logo once dogrudan, cerceve olmadan konmustu; referansta
 * ise logo her zaman kucuk bir hanedan plakasinin ICINDE duruyor. Siradan
 * renkli bir kare ya da yuvarlak kare de istenmiyor — istenen sey bu: duz
 * kenarli, omuzlari pahli, ucu sivri bir kalkan; lacivert alan, altin
 * cerceve ve cevresinde birkac kucuk sus ucu.
 *
 * NEDEN SVG. Plaka her boyutta (baslikta 38, acilista 112 piksel) keskin
 * kalmali ve tema rengiyle degismeli. Bir PNG ikisini de veremezdi.
 *
 * Logonun kendisine dokunulmuyor: kirpilmiyor, renklendirilmiyor, yalnizca
 * kalkan alanina sigacak kadar oranli kuculuyor.
 */

interface Props {
  /** Plakanin kenar uzunlugu (piksel). */
  boyut?: number;
  className?: string;
}

export const ArmaPlaka: React.FC<Props> = ({ boyut = 38, className = '' }) => (
  <span
    className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
    style={{ width: boyut, height: boyut }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full" fill="none">
      {/* Kalkan alani. */}
      <path
        d="M13.5 8h21a1.5 1.5 0 0 1 1.5 1.5V27c0 6.4-5.1 10.9-12 14.4C17.1 37.9 12 33.4 12 27V9.5A1.5 1.5 0 0 1 13.5 8Z"
        fill="var(--arma-alan)"
      />

      {/* Altin cerceve: dista kalin, icte ince — dovme maden hissi. */}
      <path
        d="M13.5 8h21a1.5 1.5 0 0 1 1.5 1.5V27c0 6.4-5.1 10.9-12 14.4C17.1 37.9 12 33.4 12 27V9.5A1.5 1.5 0 0 1 13.5 8Z"
        stroke="var(--gold-ornament)"
        strokeWidth="1.6"
      />
      <path
        d="M15 10.4h18v16.4c0 5-4 8.7-9 11.6-5-2.9-9-6.6-9-11.6Z"
        stroke="var(--gold-ornament)"
        strokeWidth="0.7"
        opacity="0.55"
      />

      {/*
        Cerceveye OTURAN altin kabaralar: ust orta, iki omuz ve alt uc.
        Ilk denemede kalkanin disina serpilmis kucuk cizgiler vardi; 38
        pikselde bunlar sus gibi degil, cizik gibi okunuyordu (ekranda
        gorüldü). Kabaralar cercevenin uzerinde durdugu icin plakayi
        dagitmadan hanedan hissini veriyor.
      */}
      <g fill="var(--gold-ornament)">
        <circle cx="24" cy="8" r="1.5" />
        <circle cx="13.6" cy="10.2" r="1.1" />
        <circle cx="34.4" cy="10.2" r="1.1" />
        <circle cx="24" cy="40.2" r="1.2" />
      </g>
    </svg>

    {/* Logo kalkanin alaninda; oran korunuyor, kirpma yok. */}
    <img
      src={logo}
      alt=""
      decoding="async"
      className="relative object-contain"
      style={{ width: boyut * 0.5, height: boyut * 0.5, marginTop: boyut * 0.02 }}
    />
  </span>
);
