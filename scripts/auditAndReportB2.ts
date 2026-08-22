import fs from 'fs';
import path from 'path';
import { RAW_SOURCE_B2, parseSourceLine } from './buildOxford5000B2';
import { EnrichedB2Entry, validateEntry } from './batchGeneratorB2';
import wordsA1 from '../src/data/wordsA1.json';
import wordsA2 from '../src/data/wordsA2.json';
import wordsB1 from '../src/data/wordsB1.json';
import wordsB2 from '../src/data/wordsB2.json';

const B2_JSON_PATH = path.join(process.cwd(), 'src/data/oxford5000ExtraB2.json');

export interface AuditReport {
  timestamp: string;
  totalSourceEntries: number;
  totalGeneratedEntries: number;
  fullyValidCount: number;
  needsReviewCount: number;
  issues: {
    sourceOrder: number;
    headword: string;
    reason: string;
  }[];
  duplicateWithOxford3000: {
    b2ExtraWord: string;
    b2ExtraPos: string;
    b2ExtraId: string;
    oxford3000Matches: {
      id: string;
      level: string;
      word: string;
      partOfSpeech: string;
    }[];
  }[];
}

export function runAudit(): AuditReport {
  if (!fs.existsSync(B2_JSON_PATH)) {
    throw new Error(`File not found: ${B2_JSON_PATH}`);
  }

  const generatedData: EnrichedB2Entry[] = JSON.parse(fs.readFileSync(B2_JSON_PATH, 'utf-8'));
  const sourceParsed = RAW_SOURCE_B2.map(line => parseSourceLine(line));

  const issues: { sourceOrder: number; headword: string; reason: string }[] = [];
  let fullyValidCount = 0;
  let needsReviewCount = 0;

  // 1. Check completeness and order
  sourceParsed.forEach((src, idx) => {
    const entry = generatedData.find(e => e.sourceOrder === src.sourceOrder);
    if (!entry) {
      issues.push({
        sourceOrder: src.sourceOrder,
        headword: src.headword,
        reason: `Missing generated entry for order ${src.sourceOrder} (${src.sourceEntry})`
      });
      needsReviewCount++;
      return;
    }

    const val = validateEntry(entry, src.sourceEntry);
    if (!val.valid) {
      issues.push({
        sourceOrder: src.sourceOrder,
        headword: src.headword,
        reason: val.reason || 'Validation failed'
      });
      needsReviewCount++;
    } else {
      fullyValidCount++;
    }
  });

  // 2. Audit against Oxford 3000
  const ox3000All = [
    ...(wordsA1 as any[]).map(w => ({ ...w, level: 'A1' })),
    ...(wordsA2 as any[]).map(w => ({ ...w, level: 'A2' })),
    ...(wordsB1 as any[]).map(w => ({ ...w, level: 'B1' })),
    ...(wordsB2 as any[]).map(w => ({ ...w, level: 'B2' }))
  ];

  const duplicateWithOxford3000: AuditReport['duplicateWithOxford3000'] = [];

  generatedData.forEach(extra => {
    const matching = ox3000All.filter(ox => ox.word.toLowerCase() === extra.headword.toLowerCase());
    if (matching.length > 0) {
      duplicateWithOxford3000.push({
        b2ExtraWord: extra.headword,
        b2ExtraPos: extra.partOfSpeech,
        b2ExtraId: extra.id,
        oxford3000Matches: matching.map(m => ({
          id: m.id,
          level: m.level,
          word: m.word,
          partOfSpeech: m.partOfSpeech
        }))
      });
    }
  });

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    totalSourceEntries: RAW_SOURCE_B2.length,
    totalGeneratedEntries: generatedData.length,
    fullyValidCount,
    needsReviewCount,
    issues,
    duplicateWithOxford3000
  };

  const reportPath = path.join(process.cwd(), 'src/data/oxford5000ExtraB2_AuditReport.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n========================================`);
  console.log(`OXFORD 5000 EXTRA B2 AUDIT REPORT`);
  console.log(`Total Source Entries: ${report.totalSourceEntries}`);
  console.log(`Total Generated Entries: ${report.totalGeneratedEntries}`);
  console.log(`Fully Valid: ${report.fullyValidCount}`);
  console.log(`Needs Review / Issues: ${report.needsReviewCount}`);
  console.log(`Overlapping Headwords with Oxford 3000 (Cross-audit): ${report.duplicateWithOxford3000.length}`);
  console.log(`Report written to: ${reportPath}`);
  console.log(`========================================\n`);

  return report;
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('auditAndReportB2')) {
  runAudit();
}
