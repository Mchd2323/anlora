/**
 * Gemini istemleri.
 *
 * `validation.ts` ile aynı gerekçeyle ayrı dosyada: hem Express sunucusu hem
 * Cloudflare Worker aynı istemleri kullanır. İstem metni değişirse iki ortam
 * birden değişsin, biri eski kalmasın — yoksa aynı uygulamanın iki dağıtımı
 * farklı kalitede kart üretir.
 */

/**
 * Kullanılacak Gemini modeli.
 *
 * NEDEN TAKMA AD. Burada bir zamanlar `gemini-2.5-flash` yazıyordu ve Gemini
 * o adı yeni anahtarlara kapattı: "no longer available to new users", 404.
 * Sürüm numarası sabitlemek, modelin emekliye ayrıldığı gün uygulamayı
 * kırıyor. `-latest` takma adı her zaman güncel flash modelini gösterir.
 *
 * Worker bu adı yalnızca bir başlangıç noktası sayar; gerçekte hangi modelin
 * çağrılabildiğini API'ye sorup deneyerek bulur (bkz. `worker/src/index.ts`).
 */
export const WORD_MODEL = 'gemini-flash-latest';

export function wordSystemInstruction(): string {
  return `You are a professional English vocabulary teacher, bilingual English-Turkish lexicographer and CEFR language-learning specialist.
A single English headword may contain multiple senses and parts of speech.
Treat each learner meaning as an independent sense.

For each sense:
- validate whether the supplied Turkish meaning matches the English word
- use the supplied context sentence when available (give highest priority to context meaning)
- identify the correct part of speech
- suggest a correction if the learner's Turkish meaning is clearly wrong
- do not silently overwrite learner input
- create example sentences that demonstrate exactly that sense
- never use an example belonging to another sense
- return natural Turkish translations of each example

Do not overwhelm the learner with rare dictionary senses. Prioritize common contemporary English.`;
}

/**
 * @param yazimDenetimi Modelden önce YAZIM DENETİMİ istenir mi?
 *
 * Kullanıcı yanlış yazdığı bir kelime için kart isteyince model eskiden yine
 * de bir şeyler yazıyordu: "recieve" diye bir İngilizce kelime yok ama kart
 * geliyordu ve yanlış yazım kullanıcının setine giriyordu. Artık model önce
 * kelimenin gerçekliğine bakıyor.
 *
 * Denetim KAPATILABİLİR olmalı: kullanıcı ısrar ederse (yeni bir terim, özel
 * addan türemiş bir kelime, modelin tanımadığı bir kullanım) ikinci istek
 * denetimsiz gider. Model de yanılır; son söz kullanıcıda.
 */
export function wordUserPrompt(
  trimmedWord: string,
  context?: string,
  yazimDenetimi = true
): string {
  return `Analyze the target English word "${trimmedWord}" for a Turkish learner.
${context ? `The user encountered this word in this context sentence: "${context}"` : ''}
${
  yazimDenetimi
    ? `SPELLING CHECK FIRST. If "${trimmedWord}" is not a real English word — a misspelling, a Turkish or other non-English word, or nonsense — do NOT invent a card. Return ONLY this JSON and nothing else:
{ "notAWord": true, "suggestion": "<the English word the learner most likely meant, or an empty string if you cannot tell>" }
Judge this conservatively. Rare, technical, archaic, dialectal, slang and proper-noun-derived words ARE real English words; produce the normal card for them. Report notAWord only when no English dictionary would list the string at all. When in doubt, produce the card.
`
    : ''
}
Requirements:
1. Provide accurate canonical lemma, standard IPA phonetic notation, and overall CEFR level ("A1" | "A2" | "B1" | "B2" | "C1" | "C2").
2. Separate distinct, common parts of speech (e.g. "n.", "v.", "adj.", "adv.", "prep.", "phr. v.", "idiom") into individual "senses".
3. For each sense, provide:
   - "id": "sense-1", "sense-2", etc.
   - "partOfSpeech": abbreviation (e.g., "n.", "v.", "adj.", "adv.", "prep.")
   - "turkishMeanings": array of 1-3 natural, modern Turkish translations (e.g. ["ışık"] or ["hafif"])
   - "shortExplanationTr": short Turkish explanation (e.g., "Ağırlığı az olan" or "Görüş sağlayan aydınlık")
   - "usageNoteTr": a short helpful note in Turkish explaining when/how this sense is used
   - "cefr": CEFR level for this specific sense
   - "examples": EXACTLY 3 natural, real-world English example sentences showing EXACTLY this sense (NEVER mixed with other senses) with fluent Turkish translations ("en" and "tr"). Three is a hard requirement, not a suggestion.
4. If context was supplied, prioritize the sense corresponding to the context sentence as the first sense!
5. Provide top-level "turkishMeaning" (concise summary of primary senses, e.g. "ışık (n.), hafif (adj.)").
6. Provide top-level "examples" containing EXACTLY 3 varied sentences illustrating the primary senses.
7. Return ONLY the fields in the schema below. Do not add extra fields; every extra field is time the learner spends waiting.

Return valid JSON with the following structure:
{
  "word": "${trimmedWord}",
  "lemma": "string",
  "phonetic": "string",
  "level": "A1 | A2 | B1 | B2 | C1 | C2",
  "partOfSpeech": "string",
  "turkishMeaning": "string",
  "contextualMeaning": "string or null",
  "senses": [
    {
      "id": "sense-1",
      "partOfSpeech": "string",
      "turkishMeanings": ["string"],
      "shortExplanationTr": "string",
      "usageNoteTr": "string",
      "cefr": "A1 | A2 | B1 | B2 | C1 | C2",
      "examples": [
        { "en": "string", "tr": "string" },
        { "en": "string", "tr": "string" },
        { "en": "string", "tr": "string" }
      ]
    }
  ],
  "examples": [
    { "en": "string", "tr": "string" },
    { "en": "string", "tr": "string" },
    { "en": "string", "tr": "string" }
  ]
}`;
}

export function sensesSystemInstruction(trimmedWord: string, contextSentence?: string): string {
  return `You are a professional English language teacher and lexicographer.
A learner is creating or editing a custom vocabulary card for "${trimmedWord}".
The learner has written one or more Turkish senses.

Your tasks:
1. Evaluate EACH user sense independently (do not evaluate the whole word as a single blob).
2. For each sense:
   - Check if the Turkish meaning matches the English word "${trimmedWord}".
   - If contextSentence is provided ("${contextSentence || ''}"), give highest priority to how the word is used in that context! For example, if word is "bank" and sentence is "We sat on the bank of the river" with meaning "kıyı", it is completely VALID.
   - Determine the correct part of speech (e.g. "n.", "v.", "adj.", "adv.", "prep.", "phr. v.").
   - Determine validationStatus:
     * "VALID": The Turkish meaning is accurate for this word.
     * "WARNING": The meaning is plausible or possible in some contexts, but ambiguous.
     * "INVALID": The meaning is completely wrong (e.g. "run" -> "okumak" or "light" -> "yürümek").
   - If "INVALID" or "WARNING", provide "aiWarningNote" and "suggestedCorrection" in Turkish without overwriting the user's text.
   - Generate EXACTLY 3 high-quality, natural, modern English example sentences that illustrate EXACTLY this sense (never an example of a different part of speech), with natural Turkish translations.
3. If there is another very common learner meaning that the user has NOT included, you may include it under "additionalSuggestions" (1-2 max).
4. Preserve the exact client id of each sense.`;
}

export function sensesUserPrompt(
  trimmedWord: string,
  userSenses: unknown,
  contextSentence?: string
): string {
  return `Target English word: "${trimmedWord}"
${contextSentence ? `Context sentence: "${contextSentence}"` : ''}

User-provided senses:
${JSON.stringify(userSenses, null, 2)}

Return valid JSON with structure:
{
  "word": "${trimmedWord}",
  "validatedSenses": [
    {
      "id": "match user sense id",
      "partOfSpeech": "n. | v. | adj. | adv. | prep. | etc.",
      "turkishMeanings": ["string"],
      "shortExplanationTr": "string",
      "aiValidationStatus": "VALID | WARNING | INVALID",
      "aiWarningNote": "string or null",
      "suggestedCorrection": "string or null",
      "examples": [
        { "en": "string", "tr": "string" },
        { "en": "string", "tr": "string" },
        { "en": "string", "tr": "string" }
      ]
    }
  ],
  "additionalSuggestions": [
    {
      "id": "sugg-1",
      "partOfSpeech": "string",
      "turkishMeanings": ["string"],
      "examples": [
        { "en": "string", "tr": "string" }
      ]
    }
  ],
  "summaryNote": "string"
}`;
}

export function examplesPrompt(
  word: string,
  turkishMeaning?: string,
  partOfSpeech?: string,
  context?: string
): string {
  return `You are a professional English vocabulary teacher.
Target English Word: "${word.trim()}"
Turkish Meaning specified by the user: "${(turkishMeaning || '').trim()}"
${partOfSpeech ? `Part of Speech: ${partOfSpeech}` : ''}
${context ? `Encountered in context: "${context}"` : ''}

Generate EXACTLY 3 natural, high-quality, modern English example sentences that illustrate this specific meaning, along with fluent Turkish translations.
DO NOT use formulaic patterns like "I learned X" or "X is useful".

Return valid JSON:
{
  "examples": [
    { "en": "string", "tr": "string" },
    { "en": "string", "tr": "string" },
    { "en": "string", "tr": "string" }
  ]
}`;
}

/** Modelin ```json çitlerini bazen eklemesi beklenir; ayrıştırmadan önce temizlenir. */
export function stripJsonFence(responseText: string): string {
  return (responseText || '').replace(/```json/g, '').replace(/```/g, '').trim();
}
