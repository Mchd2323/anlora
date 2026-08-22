import { Level } from './index';

export interface OxfordExtraSense {
  partOfSpeech: string;
  turkishMeanings: string[];
  examples: {
    en: string;
    tr: string;
  }[];
}

export interface Oxford5000ExtraEntry {
  id: string;
  sourceOrder: number;
  sourceEntry: string;
  headword: string;
  qualifier?: string;
  partOfSpeech: string;
  cefr: "B2" | "C1";
  sourceCollection: "oxford5000-extra";
  turkishMeaning: string;
  turkishMeanings: string[];
  senses: OxfordExtraSense[];
  needsReview?: boolean;
  reviewReason?: string;
}
