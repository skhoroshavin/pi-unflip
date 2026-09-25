export function needsFix(text: string): boolean {
  return hasCJKFlip(text) || MIXED_WORD.test(text);
}

function hasCJKFlip(text: string): boolean {
  // Japanese: hanzi are part of the language
  if (text.match(KANA)) return false;
  // Deliberate Chinese comes as hanzi-majority paragraphs; stray flips ride western ones
  for (const paragraph of text.split(/\n+/)) {
    const hanzi = paragraph.match(HANZI)?.length ?? 0;
    if (hanzi === 0) continue;
    const nonHanzi = (paragraph.match(WESTERN)?.length ?? 0) + (paragraph.match(HANGUL)?.length ?? 0);
    if (hanzi < nonHanzi) return true;
  }
  return false;
}

// Hiragana + katakana
const KANA = /[\u3040-\u30ff]/;
// CJK ideographs (ext A, unified, compat)
const HANZI = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
// Hangul syllables
const HANGUL = /[\uac00-\ud7af]/g;
// Latin or Cyrillic letters
const WESTERN = /[a-z\u0400-\u04ff]/gi;
// A run of Latin+Cyrillic letters containing at least one of each ("poль")
const MIXED_WORD = /[a-z]+[\u0400-\u04ff]+|[\u0400-\u04ff]+[a-z]+/i;
