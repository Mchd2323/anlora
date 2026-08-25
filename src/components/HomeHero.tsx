import React, { useMemo } from 'react';
import { BookOpen, Sparkles, GraduationCap, CheckCircle, Volume2, ArrowRight, BookMarked, ShieldCheck } from 'lucide-react';
import { TabType } from './Navbar';
import { Level } from '../types';
import { getOxford3000Words } from '../data/oxfordWords';

interface HomeHeroProps {
  onSelectLevel: (level: Level) => void;
  setActiveTab: (tab: TabType) => void;
  learnedCount: number;
  customCardsCount: number;
}

export const HomeHero: React.FC<HomeHeroProps> = ({
  onSelectLevel,
  setActiveTab,
  learnedCount,
  customCardsCount
}) => {
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
    getOxford3000Words().forEach((w) => {
      if (w.level && counts[w.level] !== undefined) {
        counts[w.level]++;
      }
    });
    return counts;
  }, []);

  const levels: { code: Level; title: string; desc: string; count: number }[] = [
    { code: 'A1', title: 'A1 - Başlangıç (Beginner)', desc: 'Temel günlük kelimeler, tanışma ve ilk diyaloglar.', count: levelCounts.A1 || 800 },
    { code: 'A2', title: 'A2 - Temel Seviye (Elementary)', desc: 'Günlük hayat, alışveriş, seyahat ve rutinler.', count: levelCounts.A2 || 700 },
    { code: 'B1', title: 'B1 - Orta Seviye (Intermediate)', desc: 'İş hayatı, fikir belirtme ve karmaşık konular.', count: levelCounts.B1 || 700 },
    { code: 'B2', title: 'B2 - İleri Orta (Upper-Int.)', desc: 'Akademik konular, soyut kavramlar ve tartışmalar.', count: levelCounts.B2 || 500 }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Sleek Hero Banner Container */}
      <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-xs border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="space-y-5 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Oxford 3000™ Resmi CEFR Müfredatı
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tight leading-tight">
            İngilizce Kelimeleri <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Kalıcı ve Akıcı</span> Öğrenin
          </h1>

          <p className="text-slate-500 text-sm leading-relaxed font-normal">
            A1'den B2'ye kadar Oxford'un belirlediği en kritik kelimeleri Türkçe karşılıkları, kelime türü kısaltmaları (n, v, adj), 3'er örnek cümle ve orijinal sesli telaffuz motoru ile çalışın.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setActiveTab('oxford')}
              className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <BookOpen className="w-4 h-4" /> Oxford Kartlarını İncele
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <BookMarked className="w-4 h-4" /> Kişisel Kelime Kartlarım
            </button>
            <button
              onClick={() => setActiveTab('quiz')}
              className="px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-2 active:scale-95"
            >
              <GraduationCap className="w-4 h-4 text-indigo-600" /> İnteraktif Sınav Yap
            </button>
          </div>
        </div>

        {/* Sleek Pro Feature Callout Card */}
        <div className="w-full md:w-80 shrink-0">
          <div className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-md">
            <div className="relative z-10 space-y-3">
              <span className="text-[10px] opacity-80 uppercase tracking-widest font-black bg-white/20 px-2 py-0.5 rounded-md inline-block">
                Özel Özellik
              </span>
              <h3 className="text-lg font-bold leading-snug">
                Kendi Çalışmalarınıza Ait Kelime Kartları Oluşturun
              </h3>
              <p className="text-xs text-indigo-100 leading-relaxed">
                Çalıştığınız kaynaklardaki bilmediğiniz kelimeleri yazın; Yapay Zeka anında Türkçe anlamı ve 3 örnek cümlesiyle kartlaştırsın.
              </p>
              <button
                onClick={() => setActiveTab('custom')}
                className="w-full py-2.5 bg-white text-indigo-600 rounded-xl font-extrabold text-xs hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <span>Yeni Kelime Kartı Oluştur</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white opacity-10 rounded-full pointer-events-none" />
          </div>
        </div>
      </section>

      {/* CEFR Level Selector Grid */}
      <section className="bg-white rounded-3xl p-8 shadow-xs border border-slate-100 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Oxford 3000™ Seviye Kartları
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Çalışmak istediğiniz seviyeyi seçin veya kartları sırayla inceleyin:
            </p>
          </div>
          <button
            onClick={() => setActiveTab('oxford')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-wider"
          >
            Tüm Kelimeler &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {levels.map((lvl) => (
            <div
              key={lvl.code}
              onClick={() => {
                onSelectLevel(lvl.code);
                setActiveTab('oxford');
              }}
              className="group bg-slate-50 hover:bg-indigo-50/50 rounded-2xl p-5 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-extrabold">
                    {lvl.code}
                  </span>
                  <span className="text-2xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/80">
                    {lvl.count} Kelime
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-base group-hover:text-indigo-600 transition-colors">
                  {lvl.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {lvl.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-indigo-600">
                <span>Kelime Kartlarını Başlat</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sleek Feature Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Volume2 className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Sesli İngilizce Telaffuz</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Kelime ve örnek cümlelerin orijinal telaffuzunu tek tıkla dinleyip tekrar edin.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm">İnteraktif Sınav Modülü</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Seviyenize özel çoktan seçmeli, boşluk doldurma ve dinleme sorularıyla bilginizi ölçün.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Çevrimdışı & Bulut Eşitleme</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            İnternetiniz olmasa bile tüm kartlar elinizin altında. Dilerseniz üyeliğinizle verilerinizi yedekleyin.
          </p>
        </div>
      </section>
    </div>
  );
};
