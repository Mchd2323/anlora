import { WordCard, WordSense, ExampleSentence } from '../types';
import { apiUrl } from '../config/api';

export interface ValidatedSenseResult {
  validatedSenses: WordSense[];
  additionalSuggestions?: WordSense[];
  summaryNote?: string;
}

export async function generateWordCardWithAi(word: string, context?: string): Promise<WordCard> {
  const response = await fetch(apiUrl('/api/ai/generate-word'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, context })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Yapay zekâ kelime bilgilerini oluşturamadı.');
  }

  const data = await response.json();
  return data;
}

export async function validateSensesWithAi(
  word: string,
  userSenses: Array<{ id: string; meaningTr: string; partOfSpeech?: string }>,
  contextSentence?: string
): Promise<ValidatedSenseResult> {
  const response = await fetch(apiUrl('/api/ai/validate-senses'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, contextSentence, userSenses })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Yapay zekâ anlamları doğrulayamadı.');
  }

  const data = await response.json();
  return data;
}

export async function generateSenseExamplesWithAi(
  word: string,
  turkishMeaning: string,
  partOfSpeech?: string,
  context?: string
): Promise<ExampleSentence[]> {
  const response = await fetch(apiUrl('/api/ai/generate-examples'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, turkishMeaning, partOfSpeech, context })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Örnek cümle oluşturulamadı.');
  }

  const data = await response.json();
  return data.examples || [];
}
