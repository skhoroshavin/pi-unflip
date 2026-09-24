export function needsFix(text: string): boolean {
  return hasCJKFlip(text) || MIXED_WORD.test(text);
}

function hasCJKFlip(text: string): boolean {
  // Japanese: hanzi are part of the language
  if (text.match(KANA)) return false;
  const hanzi = text.match(HANZI)?.length ?? 0;
  if (hanzi === 0) return false;
  // Hanzi are pollution only when they don't carry the text - Chinese answers are hanzi-majority
  const nonHanzi = (text.match(WESTERN)?.length ?? 0) + (text.match(HANGUL)?.length ?? 0);
  return hanzi < nonHanzi;
}

// Hiragana + katakana
const KANA = /[\u3040-\u30ff]/g;
// CJK ideographs (ext A, unified, compat)
const HANZI = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
// Hangul syllables
const HANGUL = /[\uac00-\ud7af]/g;
// Latin or Cyrillic letters
const WESTERN = /[a-z\u0400-\u04ff]/gi;
// A run of Latin+Cyrillic letters containing at least one of each ("poль")
const MIXED_WORD = /(?=[a-z\u0430-\u044f\u0451]*[\u0430-\u044f\u0451])(?=[a-z\u0430-\u044f\u0451]*[a-z])[a-z\u0430-\u044f\u0451]+/i;
