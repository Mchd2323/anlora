// Ekran görüntüsü için gerçekçi veri üretir. Kelimeler UYDURULMAZ:
// hepsi src/data/oxford3000.json içindeki gerçek maddelerden seçilir.
import fs from 'node:fs';

// Her iki Oxford listesi de taranır: aradığımız kelimelerin bir kısmı
// 3000'de değil 5000 ek listesinde duruyor.
const ox = [
  ...JSON.parse(fs.readFileSync('src/data/oxford3000.json', 'utf8')),
  ...JSON.parse(fs.readFileSync('src/data/oxford5000extra.json', 'utf8')),
];
const byWord = new Map();
for (const w of ox) if (!byWord.has(w.headword)) byWord.set(w.headword, w);

const setler = [
  { ad: 'Breaking Bad S02', renk: 'amber',   ikon: 'Tv',
    kelimeler: ['negotiate','fragile','suspicious','deliberate','threat','confess','loyal','betray'] },
  { ad: 'İş İngilizcesi',   renk: 'indigo',  ikon: 'Briefcase',
    kelimeler: ['invoice','deadline','revenue','negotiate','client','schedule','budget','profit'] },
  { ad: 'Akademik Okuma',   renk: 'emerald', ikon: 'GraduationCap',
    kelimeler: ['analyse','evidence','conclude','significant','hypothesis','assume','derive','valid'] },
];

const simdi = new Date();
const iso = d => d.toISOString();
const gunEkle = (d, n) => new Date(d.getTime() + n * 86400000);

const collections = [], memberships = [], learningStates = {};
const gorulen = new Set();
let bulunamayan = [];

setler.forEach((s, i) => {
  const cid = `col-demo-${i + 1}`;
  const olusturma = iso(gunEkle(simdi, -30 + i * 7));
  collections.push({
    id: cid, name: s.ad, iconName: s.ikon, color: s.renk,
    isPinned: i === 0, isArchived: false, sortMode: 'added',
    createdAt: olusturma, updatedAt: iso(gunEkle(simdi, -i)),
  });

  s.kelimeler.forEach((k, j) => {
    const w = byWord.get(k);
    if (!w) { bulunamayan.push(k); return; }
    memberships.push({
      id: `mem-${cid}-${j}`, wordId: w.id, collectionId: cid,
      sourceName: i === 0 ? 'Breaking Bad S02E05' : undefined,
      addedAt: iso(gunEkle(simdi, -28 + j)),
    });

    if (gorulen.has(w.id)) return;
    gorulen.add(w.id);

    // Aşamalar karışık olsun: ekranda tek tip bir tablo görünmesin.
    const desen = [
      { stage:'MASTERED',  mastery: 94, interval: 60, gecmis: -3, sonraki: 57, dogru: 9, yanlis: 0 },
      { stage:'REVIEW',    mastery: 71, interval: 14, gecmis: -2, sonraki: 12, dogru: 6, yanlis: 1 },
      { stage:'LEARNING',  mastery: 38, interval: 3,  gecmis: -1, sonraki: 0,  dogru: 2, yanlis: 2 },
      { stage:'WEAK',      mastery: 22, interval: 1,  gecmis: -1, sonraki: 0,  dogru: 1, yanlis: 4 },
      { stage:'REVIEW',    mastery: 83, interval: 30, gecmis: -5, sonraki: 25, dogru: 8, yanlis: 1 },
      { stage:'NEW',       mastery: 0,  interval: 0,  gecmis: null, sonraki: 0, dogru: 0, yanlis: 0 },
    ][(i * 3 + j) % 6];

    learningStates[w.id] = {
      wordId: w.id,
      userStatus: desen.stage === 'MASTERED' ? 'learned' : desen.stage === 'NEW' ? 'unseen' : 'learning',
      stage: desen.stage,
      masteryScore: desen.mastery,
      difficulty: desen.stage === 'WEAK' ? 0.8 : 0.35,
      reviewCount: desen.dogru + desen.yanlis,
      correctCount: desen.dogru,
      wrongCount: desen.yanlis,
      consecutiveCorrect: desen.yanlis === 0 ? desen.dogru : 1,
      consecutiveWrong: desen.stage === 'WEAK' ? 2 : 0,
      intervalDays: desen.interval,
      lastReviewedAt: desen.gecmis === null ? undefined : iso(gunEkle(simdi, desen.gecmis)),
      nextReviewAt: iso(gunEkle(simdi, desen.sonraki)),
      lastResponseQuality: desen.stage === 'WEAK' ? 'again' : 'good',
    };
  });
});

const ogrenilen = Object.values(learningStates).filter(s => s.stage === 'MASTERED').length;

const stats = {
  totalQuizzesTaken: 23, totalCorrect: 198, totalWrong: 41,
  streakDays: 12, lastActiveDate: iso(simdi), mistakesMap: {},
  learnedCount: ogrenilen, favoriteCount: 4,
  customCardsCount: 0, totalStudySessionsCompleted: 31, bestQuizAccuracy: 92,
};

const favoriler = memberships.slice(0, 4).map(m => m.wordId);

const tohum = {
  lexiflow_v2_migration_done: 'true',
  lexiflow_v2_collections: JSON.stringify(collections),
  lexiflow_v2_memberships: JSON.stringify(memberships),
  lexiflow_v2_learning_states: JSON.stringify(learningStates),
  lexiflow_v2_stats: JSON.stringify(stats),
  lexiflow_v2_favorites: JSON.stringify(favoriler),
  lexiflow_v2_custom_words: JSON.stringify([]),
  lexiflow_v2_review_history: JSON.stringify([]),
};

fs.writeFileSync('scripts/store/tohum.json', JSON.stringify(tohum));
console.log(`set: ${collections.length}, üyelik: ${memberships.length}, ` +
            `benzersiz kelime: ${gorulen.size}, öğrenilen: ${ogrenilen}`);
if (bulunamayan.length) console.log('Oxford 3000 içinde bulunamayan:', bulunamayan.join(', '));
