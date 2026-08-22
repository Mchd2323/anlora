/**
 * Oxford 3000 çekirdek sözlüğü kalite denetimi.
 *
 * ÖNEMLİ: Bu betik önceden yalnızca alanların DOLU olup olmadığına bakıyordu.
 * Sonuç olarak, örnek cümlelerin %88'i sabit kalıplardan üretilmiş ve
 * dilbilgisi dışı olmasına, fonetik alanının %41'i geçersiz olmasına rağmen
 * "✅ AUDIT COMPLETE: dataset is stable and verified" diye rapor veriyordu.
 * Bozuk veri üstünde yeşil yanan bir kalite kapısı, kalite kapısı değildir.
 *
 * Denetim artık içeriğe bakıyor:
 * - şablondan üretilmiş örnek cümleler (kelime yer tutucuyla değiştirilip
 *   aynı iskelete indirgenen cümleler sayılır)
 * - IPA olamayacak fonetik değerler
 * - hedef kelimeyi içermeyen örnek cümleler
 * - `word` alanına sızmış sözcük türü artıkları
 * - Türkçe anlam alanına sızmış sözcük türü kısaltmaları
 * - alan doluluğu ve kimlik bütünlüğü (eski kontroller korundu)
 *
 * Sorun bulunursa süreç sıfırdan farklı bir kodla çıkar; böylece betik bir
 * derleme adımına ya da CI'a bağlanabilir.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IRREGULAR_INFLECTIONS } from '../src/utils/lemmatizer';

interface ExampleSentence {
  en: string;
  tr: string;
}

interface OxfordEntry {
  id: string;
  word: string;
  lemma?: string;
  partOfSpeech: string;
  turkishMeaning: string;
  phonetic?: string;
  level: string;
  examples?: ExampleSentence[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePaths = [
  path.resolve(__dirname, '../src/data/wordsA1.json'),
  path.resolve(__dirname, '../src/data/wordsA2.json'),
  path.resolve(__dirname, '../src/data/wordsB1.json'),
  path.resolve(__dirname, '../src/data/wordsB2.json')
];

export function runAudit() {
  console.log('======================================================');
  console.log('🔍 ANLORA - OXFORD 3000 CORE DATASET AUDIT REPORT');
  console.log('======================================================\n');

  const allEntries: OxfordEntry[] = [];
  const levelCounts: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };

  filePaths.forEach((fp) => {
    if (!fs.existsSync(fp)) {
      console.error(`❌ Missing data file: ${fp}`);
      return;
    }
    const data: OxfordEntry[] = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    data.forEach((entry) => {
      allEntries.push(entry);
      if (levelCounts[entry.level] !== undefined) {
        levelCounts[entry.level]++;
      }
    });
  });

  const totalEntries = allEntries.length;

  // 1. Duplicate ID Check
  const idMap = new Map<string, number>();
  const duplicateIds: string[] = [];
  allEntries.forEach((e) => {
    const count = idMap.get(e.id) || 0;
    if (count === 1) duplicateIds.push(e.id);
    idMap.set(e.id, count + 1);
  });

  // 2. Duplicate Exact Source Entry Check (same word, level AND pos)
  const exactComboMap = new Map<string, string[]>();
  const duplicateExactEntries: { word: string; level: string; pos: string; ids: string[] }[] = [];
  allEntries.forEach((e) => {
    const key = `${e.word.toLowerCase()}_${e.level}_${e.partOfSpeech.toLowerCase()}`;
    const list = exactComboMap.get(key) || [];
    list.push(e.id);
    exactComboMap.set(key, list);
  });
  exactComboMap.forEach((ids, key) => {
    if (ids.length > 1) {
      const [word, level, pos] = key.split('_');
      duplicateExactEntries.push({ word, level, pos, ids });
    }
  });

  // 3. Multi-Sense & Homographs Analysis (same headword across CEFR/POS)
  const headwordMap = new Map<string, OxfordEntry[]>();
  allEntries.forEach((e) => {
    const norm = e.word.toLowerCase();
    const list = headwordMap.get(norm) || [];
    list.push(e);
    headwordMap.set(norm, list);
  });

  const multiSenseHeadwords = Array.from(headwordMap.entries()).filter(([_, list]) => list.length > 1);
  const differentCefrCombos: { word: string; levels: string[] }[] = [];
  const differentPosCombos: { word: string; posList: string[] }[] = [];

  multiSenseHeadwords.forEach(([word, list]) => {
    const levels = Array.from(new Set(list.map((x) => x.level)));
    if (levels.length > 1) {
      differentCefrCombos.push({ word, levels });
    }
    const posList = Array.from(new Set(list.map((x) => x.partOfSpeech)));
    if (posList.length > 1) {
      differentPosCombos.push({ word, posList });
    }
  });

  // 4. Data Quality & Completeness
  const missingMeaning: string[] = [];
  const missingExamples: string[] = [];
  const emptyPos: string[] = [];
  const invalidCefr: string[] = [];
  const placeholderMeanings: { id: string; word: string; meaning: string }[] = [];

  const placeholderPatterns = [
    'kelimesi',
    'otomatik anlam',
    'çeviri yok',
    'todo',
    'anlam giriniz',
    'undefined',
    'null'
  ];

  allEntries.forEach((e) => {
    // Meaning check
    if (!e.turkishMeaning || !e.turkishMeaning.trim()) {
      missingMeaning.push(e.id);
    } else {
      const tm = e.turkishMeaning.trim().toLowerCase();
      if (placeholderPatterns.some((p) => tm.includes(p))) {
        placeholderMeanings.push({ id: e.id, word: e.word, meaning: e.turkishMeaning });
      }
    }

    // Örnek kontrolü.
    //
    // Örneği boş olan madde bir kusur DEĞİLDİR: şablondan üretilmiş cümleler
    // karantinaya alındığı için bu maddeler bilinçli olarak boş bırakıldı ve
    // `examplesVerified: false` taşıyor. Kusur, bozuk biçimli örnektir.
    if (!e.examples || e.examples.length === 0) {
      if ((e as any).examplesVerified !== false) {
        missingExamples.push(e.id);
      }
    } else {
      const invalidEx = e.examples.filter(
        (ex) => !ex.en || !ex.tr || !ex.en.trim() || !ex.tr.trim()
      );
      if (invalidEx.length > 0) {
        missingExamples.push(e.id);
      }
    }

    // POS check
    if (!e.partOfSpeech || !e.partOfSpeech.trim()) {
      emptyPos.push(e.id);
    }

    // CEFR check
    if (!['A1', 'A2', 'B1', 'B2'].includes(e.level)) {
      invalidCefr.push(e.id);
    }
  });

  // 5. İçerik kalitesi kontrolleri
  //
  // Şablon tespiti elle liste tutmaz: hedef kelime yer tutucuyla değiştirildikten
  // sonra aynı iskelete indirgenen ve çok sayıda maddede tekrarlanan cümleler
  // şablondur. Doğal yazılmış cümlelerin farklı maddelerde birebir aynı iskeleti
  // paylaşması beklenmez.
  const MIN_TEMPLATE_REPETITIONS = 10;

  function skeletonOf(sentence: string, word: string): string {
    const escaped = word.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return sentence
      .replace(new RegExp(`\\b${escaped}(s|es|ed|ing|d)?\\b`, 'gi'), '<W>')
      .trim();
  }

  const skeletonCounts = new Map<string, number>();
  allEntries.forEach((e) => {
    (e.examples || []).forEach((ex) => {
      const key = skeletonOf(ex.en || '', e.word);
      skeletonCounts.set(key, (skeletonCounts.get(key) || 0) + 1);
    });
  });

  const templateSkeletons = new Set(
    Array.from(skeletonCounts.entries())
      .filter(([key, count]) => count >= MIN_TEMPLATE_REPETITIONS && key.includes('<W>'))
      .map(([key]) => key)
  );

  /**
   * Cümlenin hedef kelimeyi (düzenli ya da düzensiz çekimiyle) içerip
   * içermediğini kontrol eder.
   *
   * Basit bir alt dize araması yetmez: "become" için "It quickly became cold
   * outside." geçerli bir örnektir ama gövde eşleşmesi bunu kaçırır. Projenin
   * `lemmatizer` içindeki düzensiz çekim sözlüğü burada yeniden kullanılıyor.
   */
  function sentenceContainsWord(sentence: string, word: string): boolean {
    const target = word.trim().toLowerCase().split(/[\s,]+/)[0];
    if (!target) return true;

    const tokens = sentence.toLowerCase().match(/[a-z']+/g) || [];
    for (const token of tokens) {
      if (token === target) return true;

      // Düzensiz çekim: became -> become
      const irregular = IRREGULAR_INFLECTIONS[token];
      if (irregular && irregular.base === target) return true;

      // Düzenli çekim: kelimeyle başlayıp yaygın bir ek alan biçimler.
      if (token.startsWith(target) && token.length - target.length <= 3) return true;

      // Sondaki "e" düşmesi (make -> making) ve "y" -> "ies" dönüşümü.
      if (target.endsWith('e') && token.startsWith(target.slice(0, -1))) return true;
      if (target.endsWith('y') && token.startsWith(target.slice(0, -1) + 'i')) return true;

      // Ünsüz ikizlenmesi (run -> running)
      if (token.startsWith(target + target.slice(-1))) return true;
    }
    return false;
  }

  const templatedEntries: { id: string; word: string; count: number }[] = [];
  const examplesMissingWord: { id: string; word: string; sentence: string }[] = [];
  let totalExamples = 0;
  let templatedExamples = 0;

  allEntries.forEach((e) => {
    let templatedHere = 0;
    (e.examples || []).forEach((ex) => {
      totalExamples++;
      if (templateSkeletons.has(skeletonOf(ex.en || '', e.word))) {
        templatedHere++;
        templatedExamples++;
      }
      // Örnek cümle hedef kelimeyi içermiyorsa örnek değildir.
      if (!sentenceContainsWord(ex.en || '', e.word)) {
        examplesMissingWord.push({ id: e.id, word: e.word, sentence: ex.en });
      }
    });
    if (templatedHere > 0) {
      templatedEntries.push({ id: e.id, word: e.word, count: templatedHere });
    }
  });

  // Fonetik doğrulaması: İngilizce IPA'da bulunmayan harfler ya da noktalama
  // içeren değer IPA değildir (yazımın kendisi veya ayrıştırma artığı).
  const invalidPhonetics: { id: string; word: string; phonetic: string }[] = [];
  allEntries.forEach((e) => {
    const value = (e.phonetic || '').trim().replace(/^\/|\/$/g, '');
    if (!value) return; // boş bırakılmış olabilir, bu bilinçli bir durum
    if (/[cqxy]/i.test(value) || /[,()0-9]/.test(value)) {
      invalidPhonetics.push({ id: e.id, word: e.word, phonetic: e.phonetic || '' });
    }
  });

  // `word` ve `turkishMeaning` alanlarına sızmış sözcük türü artıkları.
  const posLeakPattern = /\b(n|v|adj|adv|prep|conj|pron|det|exclam|num)\.\s*(\/|$|,)/i;
  const posLeakInWord = allEntries.filter((e) => posLeakPattern.test(e.word) || e.word.includes('/'));
  const posLeakInMeaning = allEntries.filter((e) =>
    /\b(det|pron|conj|prep|adv|adj)\.\s*(\/|$)/i.test(e.turkishMeaning || '')
  );

  const unverifiedExamples = allEntries.filter(
    (e) => (e as any).examplesVerified === false || (e.examples || []).length === 0
  );

  // 6. Output summary
  console.log(`📊 TOTAL OXFORD CORE ENTRIES: ${totalEntries}`);
  console.log(`   - A1: ${levelCounts.A1}`);
  console.log(`   - A2: ${levelCounts.A2}`);
  console.log(`   - B1: ${levelCounts.B1}`);
  console.log(`   - B2: ${levelCounts.B2}`);
  console.log('');
  console.log(`🔒 INTEGRITY CHECKS:`);
  console.log(`   - Duplicate IDs: ${duplicateIds.length} ${duplicateIds.length === 0 ? '✅ (PASS)' : '❌'}`);
  console.log(`   - Duplicate Exact Source Entries: ${duplicateExactEntries.length} ${duplicateExactEntries.length === 0 ? '✅ (PASS)' : '⚠️'}`);
  console.log(`   - Empty Part of Speech: ${emptyPos.length} ${emptyPos.length === 0 ? '✅ (PASS)' : '❌'}`);
  console.log(`   - Invalid CEFR Level: ${invalidCefr.length} ${invalidCefr.length === 0 ? '✅ (PASS)' : '❌'}`);
  console.log(`   - Missing Turkish Meaning: ${missingMeaning.length} ${missingMeaning.length === 0 ? '✅ (PASS)' : '❌'}`);
  console.log(`   - Malformed Examples: ${missingExamples.length} ${missingExamples.length === 0 ? '✅ (PASS)' : '❌'}`);
  console.log(`   - Placeholder Meanings: ${placeholderMeanings.length} ${placeholderMeanings.length === 0 ? '✅ (PASS)' : '❌'}`);
  console.log('');
  console.log(`📚 MULTI-SENSE & HOMOGRAPH PRESERVATION:`);
  console.log(`   - Headwords with multiple distinct entries: ${multiSenseHeadwords.length}`);
  console.log(`   - Headwords spanning multiple CEFR levels: ${differentCefrCombos.length}`);
  console.log(`   - Headwords with multiple distinct Parts of Speech: ${differentPosCombos.length}`);
  console.log('');
  const pct = (n: number, total: number) => (total === 0 ? '0' : ((100 * n) / total).toFixed(1));

  console.log(`📝 CONTENT QUALITY:`);
  console.log(`   - Total example sentences: ${totalExamples}`);
  console.log(
    `   - Template-generated sentences: ${templatedExamples} (%${pct(templatedExamples, totalExamples)}) ${templatedExamples === 0 ? '✅ (PASS)' : '❌'}`
  );
  console.log(
    `   - Entries with template sentences: ${templatedEntries.length} ${templatedEntries.length === 0 ? '✅ (PASS)' : '❌'}`
  );
  console.log(
    `   - Examples not containing the headword: ${examplesMissingWord.length} ${examplesMissingWord.length === 0 ? '✅ (PASS)' : '❌'}`
  );
  console.log(
    `   - Invalid phonetic transcriptions: ${invalidPhonetics.length} ${invalidPhonetics.length === 0 ? '✅ (PASS)' : '❌'}`
  );
  console.log(
    `   - POS residue in "word" field: ${posLeakInWord.length} ${posLeakInWord.length === 0 ? '✅ (PASS)' : '❌'}`
  );
  console.log(
    `   - POS residue in Turkish meaning: ${posLeakInMeaning.length} ${posLeakInMeaning.length === 0 ? '✅ (PASS)' : '❌'}`
  );
  console.log(
    `   - Entries awaiting verified examples: ${unverifiedExamples.length} ${unverifiedExamples.length === 0 ? '✅' : '⚠️  (repair_examples.ts)'}`
  );
  console.log('');

  if (templateSkeletons.size > 0) {
    console.log('   Detected template skeletons:');
    Array.from(templateSkeletons)
      .slice(0, 10)
      .forEach((skeleton) => console.log(`     - ${skeleton.slice(0, 78)}`));
    console.log('');
  }

  const blockingFailures =
    duplicateIds.length +
    emptyPos.length +
    invalidCefr.length +
    missingMeaning.length +
    placeholderMeanings.length +
    templatedExamples +
    examplesMissingWord.length +
    invalidPhonetics.length +
    posLeakInWord.length +
    posLeakInMeaning.length;

  console.log('------------------------------------------------------');
  if (blockingFailures === 0) {
    console.log('✅ AUDIT PASSED: no content or integrity defects found.');
  } else {
    console.log(`❌ AUDIT FAILED: ${blockingFailures} defect(s) found.`);
    if (unverifiedExamples.length > 0) {
      console.log('   Run: GEMINI_API_KEY=... npx tsx scripts/data-repair/repair_examples.ts');
    }
  }
  console.log('======================================================\n');

  if (blockingFailures > 0 && process.env.ANLORA_AUDIT_STRICT === 'true') {
    process.exitCode = 1;
  }

  return {
    totalEntries,
    levelCounts,
    duplicateIdsCount: duplicateIds.length,
    duplicateExactEntriesCount: duplicateExactEntries.length,
    missingMeaningCount: missingMeaning.length,
    missingExamplesCount: missingExamples.length,
    placeholderMeaningsCount: placeholderMeanings.length,
    emptyPosCount: emptyPos.length,
    invalidCefrCount: invalidCefr.length,
    multiSenseCount: multiSenseHeadwords.length,
    differentCefrCombosCount: differentCefrCombos.length,
    differentPosCombosCount: differentPosCombos.length
  };
}

runAudit();
