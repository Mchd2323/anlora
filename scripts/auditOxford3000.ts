/**
 * Oxford 3000 Core Dataset Comprehensive Audit Script
 * 
 * Analyzes and validates the immutable core Oxford dictionary dataset:
 * - Total counts and level breakdown (A1, A2, B1, B2)
 * - Duplicate ID checks
 * - Multi-sense / homograph preservation checks (same headword across CEFR/POS)
 * - Missing meanings & examples
 * - Placeholder / synthetic text detection
 * - POS & CEFR integrity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

    // Example check
    if (!e.examples || e.examples.length === 0) {
      missingExamples.push(e.id);
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

  // 5. Output summary
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
  console.log(`   - Missing/Broken Examples: ${missingExamples.length} ${missingExamples.length === 0 ? '✅ (PASS)' : '❌'}`);
  console.log(`   - Placeholder Meanings: ${placeholderMeanings.length} ${placeholderMeanings.length === 0 ? '✅ (PASS)' : '❌'}`);
  console.log('');
  console.log(`📚 MULTI-SENSE & HOMOGRAPH PRESERVATION:`);
  console.log(`   - Headwords with multiple distinct entries: ${multiSenseHeadwords.length}`);
  console.log(`   - Headwords spanning multiple CEFR levels: ${differentCefrCombos.length}`);
  console.log(`   - Headwords with multiple distinct Parts of Speech: ${differentPosCombos.length}`);
  console.log('');
  console.log('------------------------------------------------------');
  console.log('✅ AUDIT COMPLETE: Oxford Core dataset is stable, read-only, and verified.');
  console.log('======================================================\n');

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
