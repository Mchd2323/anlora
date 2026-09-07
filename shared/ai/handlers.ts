/**
 * Yapay zekâ uçlarının çalışma ortamından bağımsız gövdesi.
 *
 * Express de Cloudflare Worker da aynı işi yapar: gövdeyi denetle, istemi kur,
 * modeli çağır, dönen JSON'u ayrıştır ve doğrula. Farklı olan tek şey modele
 * NASIL ulaşıldığı — Node'da `@google/genai` istemcisi, Worker'da düz `fetch`.
 * Bu yüzden model çağrısı dışarıdan bir `AiGateway` olarak veriliyor.
 *
 * Önbellek ve kota burada YOK: onlar ortama özgü. Sunucunun diskte ortak bir
 * önbelleği var, Worker'ın yok. İkisini de buraya sıkıştırmak, olmayan bir
 * dosya sistemini Worker'a anlatmak olurdu.
 */

import { stripJsonFence, wordSystemInstruction, wordUserPrompt } from './prompts';
import { examplesPrompt, sensesSystemInstruction, sensesUserPrompt } from './prompts';
import { validateGeneratedWordCard } from './validation';

/** Modeli çağırıp ham metni döndüren köprü. */
export interface AiGateway {
  generateJson(input: { prompt: string; systemInstruction?: string }): Promise<string>;
}

/** Ucun HTTP karşılığı: durum kodu ve gövde. */
export interface AiResult {
  status: number;
  body: Record<string, unknown>;
}

const CARD_FAILURE = {
  error:
    'Yapay zekâ şu anda kelime bilgilerini oluşturamadı. Tekrar deneyebilir veya kartı kendiniz doldurabilirsiniz.',
};

/**
 * Bir kelime için tam kart üretir.
 *
 * Doğrulama başarısız olursa bir kez daha denenir. İkisi de geçmezse kart
 * DÖNDÜRÜLMEZ: kusurlu bir kartı kullanıcıya vermek, uydurma anlamı sözlük
 * bilgisiymiş gibi göstermek olurdu (talimat 59).
 */
export async function handleGenerateWord(
  body: { word?: unknown; context?: unknown },
  gateway: AiGateway
): Promise<AiResult> {
  const { word, context } = body;
  if (!word || typeof word !== 'string' || !word.trim()) {
    return { status: 400, body: { error: 'Kelime girilmedi.' } };
  }

  const trimmedWord = word.trim();
  const contextText = typeof context === 'string' && context.trim() ? context.trim() : undefined;

  const systemInstruction = wordSystemInstruction();
  const prompt = wordUserPrompt(trimmedWord, contextText);

  let attempts = 0;
  let finalCard: Record<string, unknown> | null = null;

  while (attempts < 2 && !finalCard) {
    attempts++;
    const responseText = await gateway.generateJson({ prompt, systemInstruction });
    try {
      const parsed = JSON.parse(stripJsonFence(responseText));
      if (validateGeneratedWordCard(parsed, trimmedWord)) {
        finalCard = parsed;
      }
    } catch {
      // Bozuk JSON: bir sonraki denemeye geçilir, kullanıcıya çöp gönderilmez.
    }
  }

  if (!finalCard) {
    return { status: 500, body: { ...CARD_FAILURE, code: 'AI_VALIDATION_FAILED' } };
  }

  return { status: 200, body: finalCard };
}

/** Kullanıcının yazdığı anlamları tek tek denetler. */
export async function handleValidateSenses(
  body: { word?: unknown; contextSentence?: unknown; userSenses?: unknown },
  gateway: AiGateway
): Promise<AiResult> {
  const { word, contextSentence, userSenses } = body;
  if (!word || typeof word !== 'string' || !word.trim()) {
    return { status: 400, body: { error: 'Kelime girilmedi.' } };
  }
  if (!Array.isArray(userSenses) || userSenses.length === 0) {
    return { status: 400, body: { error: 'Doğrulanacak anlam bulunamadı.' } };
  }

  const trimmedWord = word.trim();
  const contextText =
    typeof contextSentence === 'string' && contextSentence.trim()
      ? contextSentence.trim()
      : undefined;

  const responseText = await gateway.generateJson({
    prompt: sensesUserPrompt(trimmedWord, userSenses, contextText),
    systemInstruction: sensesSystemInstruction(trimmedWord, contextText),
  });

  return { status: 200, body: JSON.parse(stripJsonFence(responseText)) };
}

/** Kullanıcının belirlediği anlam için örnek cümle üretir. */
export async function handleGenerateExamples(
  body: {
    word?: unknown;
    turkishMeaning?: unknown;
    partOfSpeech?: unknown;
    context?: unknown;
  },
  gateway: AiGateway
): Promise<AiResult> {
  const { word, turkishMeaning, partOfSpeech, context } = body;
  if (!word || typeof word !== 'string') {
    return { status: 400, body: { error: 'Kelime girilmedi.' } };
  }

  const responseText = await gateway.generateJson({
    prompt: examplesPrompt(
      word,
      typeof turkishMeaning === 'string' ? turkishMeaning : undefined,
      typeof partOfSpeech === 'string' ? partOfSpeech : undefined,
      typeof context === 'string' ? context : undefined
    ),
  });

  const parsed = JSON.parse(stripJsonFence(responseText));
  if (!Array.isArray(parsed.examples) || parsed.examples.length === 0) {
    return { status: 500, body: { error: 'Örnek cümleler üretilemedi.', code: 'AI_EMPTY_EXAMPLES' } };
  }

  return { status: 200, body: { examples: parsed.examples } };
}
